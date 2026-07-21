import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import type {
  QualityModelCapacity,
  QualityModelSelection,
  QualityWorker,
  QualityWorkerRequest,
  QualityWorkerResult,
} from "../domain/quality-worker.js";
import { parsePiJsonEvents, parsePiModelList } from "./pi-json-events.js";
import { composePiWorkerInput, piModelListArgs, piRunArgs, validateQualityWorkerRequest } from "./quality-worker.js";

export interface PiPrintWorkerOptions {
  executable?: string;
  prefixArgs?: readonly string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  maximumStdoutBytes?: number;
  metadataTimeoutMs?: number;
}

interface ProcessResult {
  stdout: string;
  code: number;
}

function positiveInteger(value: number | undefined, fallback: number, label: string): number {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < 1) throw new Error(`${label} must be a positive integer.`);
  return resolved;
}

function commandFrom(options: PiPrintWorkerOptions): string {
  const configured = options.executable ?? options.env?.NOVEL_FORGE_PI_COMMAND ?? process.env.NOVEL_FORGE_PI_COMMAND ?? "pi";
  const command = configured.trim();
  if (!command || command.includes("\0")) throw new Error("Pi executable is invalid.");
  return command;
}

export class PiPrintWorker implements QualityWorker {
  readonly #options: PiPrintWorkerOptions;
  readonly #capacityCache = new Map<string, QualityModelCapacity | null>();

  constructor(options: PiPrintWorkerOptions = {}) {
    this.#options = {
      ...options,
      prefixArgs: [...(options.prefixArgs ?? [])],
      maximumStdoutBytes: positiveInteger(options.maximumStdoutBytes, 8 * 1024 * 1024, "Maximum worker output bytes"),
      metadataTimeoutMs: positiveInteger(options.metadataTimeoutMs, 15_000, "Metadata timeout"),
    };
  }

  async #execute(
    args: readonly string[],
    stdin: string,
    timeoutMs: number,
    signal: AbortSignal | undefined,
    purpose: "worker" | "metadata",
  ): Promise<ProcessResult> {
    if (signal?.aborted) throw new Error(`Pi ${purpose} request was aborted.`);
    const executable = commandFrom(this.#options);
    const maximumStdoutBytes = this.#options.maximumStdoutBytes ?? 8 * 1024 * 1024;
    return await new Promise<ProcessResult>((resolve, reject) => {
      let settled = false;
      let stdout = "";
      let stdoutBytes = 0;
      const child = spawn(executable, [...args], {
        cwd: this.#options.cwd,
        env: {
          ...process.env,
          ...this.#options.env,
          PI_SKIP_VERSION_CHECK: "1",
        },
        shell: false,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });

      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      };
      const fail = (error: Error, terminate = false) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (terminate && !child.killed) child.kill("SIGTERM");
        reject(error);
      };
      const onAbort = () => fail(new Error(`Pi ${purpose} request was aborted.`), true);
      const timer = setTimeout(() => fail(new Error(`Pi ${purpose} request timed out.`), true), timeoutMs);
      signal?.addEventListener("abort", onAbort, { once: true });

      child.on("error", () => fail(new Error("Pi worker is unavailable.")));
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        if (settled) return;
        stdoutBytes += Buffer.byteLength(chunk, "utf8");
        if (stdoutBytes > maximumStdoutBytes) {
          fail(new Error("Pi worker output exceeded the local safety limit."), true);
          return;
        }
        stdout += chunk;
      });
      child.stderr.resume();
      child.stdin.on("error", () => undefined);
      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        cleanup();
        const normalizedCode = code ?? 1;
        if (normalizedCode !== 0) {
          reject(new Error(`Pi ${purpose} exited with code ${normalizedCode}.`));
          return;
        }
        resolve({ stdout, code: normalizedCode });
      });
      child.stdin.end(stdin);
    });
  }

  async resolveModelCapacity(selection: QualityModelSelection, signal?: AbortSignal): Promise<QualityModelCapacity | null> {
    const model = selection.model.trim();
    const provider = selection.provider?.trim();
    if (!model) throw new Error("Model must be nonblank.");
    if (selection.provider !== undefined && !provider) throw new Error("Provider must be nonblank.");
    const key = `${provider ?? ""}\u0000${model}`;
    if (this.#capacityCache.has(key)) return this.#capacityCache.get(key) ?? null;
    try {
      const result = await this.#execute(
        piModelListArgs({ ...(provider ? { provider } : {}), model }, this.#options.prefixArgs),
        "",
        this.#options.metadataTimeoutMs ?? 15_000,
        signal,
        "metadata",
      );
      const capacity = parsePiModelList(result.stdout, provider, model);
      this.#capacityCache.set(key, capacity);
      return capacity;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/unavailable|aborted/i.test(message)) throw error;
      this.#capacityCache.set(key, null);
      return null;
    }
  }

  async run(request: QualityWorkerRequest, signal?: AbortSignal): Promise<QualityWorkerResult> {
    validateQualityWorkerRequest(request);
    const started = performance.now();
    const result = await this.#execute(
      piRunArgs(request, this.#options.prefixArgs),
      composePiWorkerInput(request),
      request.timeoutMs,
      signal,
      "worker",
    );
    return parsePiJsonEvents(result.stdout, request, Math.max(0, performance.now() - started));
  }
}
