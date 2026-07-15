import Busboy from "busboy";
import { randomBytes } from "node:crypto";
import { createWriteStream, mkdtempSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openWizardBrowser } from "./browser.js";
import { readJson, requireApiAuthorization, sendJson, sendText } from "./server.js";
import type { WizardProposalEnvelope, WizardSessionHandle, WizardSessionOptions, WizardSource, WizardWorkflow } from "./types.js";

const workflows = new Set<WizardWorkflow>(["adoption", "readers", "packaging", "next-book"]);
const allowedExtensions = new Set([".docx", ".epub", ".md", ".txt", ".csv", ".xlsx"]);
const staticRoot = fileURLToPath(new URL("../../wizard/", import.meta.url));

function statusError(statusCode: number, message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

function workflow(value: unknown): WizardWorkflow {
  if (typeof value !== "string" || !workflows.has(value as WizardWorkflow)) throw statusError(400, "Unknown wizard workflow.");
  return value as WizardWorkflow;
}

function contentType(path: string): string {
  if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  return "text/html; charset=utf-8";
}

function staticPath(urlPath: string): string | null {
  if (urlPath === "/" || urlPath === "/index.html") return join(staticRoot, "index.html");
  if (urlPath === "/app.js") return join(staticRoot, "app.js");
  if (urlPath === "/styles.css") return join(staticRoot, "styles.css");
  return null;
}

function safeOriginalName(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  return basename(normalized).replace(/[\u0000-\u001f\u007f]/g, "").trim() || "upload";
}

interface UploadResult extends WizardSource { storedName: string }

function receiveUpload(request: IncomingMessage, uploadRoot: string, limit: number): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    let seen = false;
    let pendingError: (Error & { statusCode?: number }) | null = null;
    let result: UploadResult | null = null;
    let writeFinished: Promise<void> | null = null;
    let tooLarge = false;
    let storedPath = "";

    const parser = Busboy({ headers: request.headers, limits: { files: 1, fileSize: limit, fields: 0, parts: 1 } });
    parser.on("file", (_field, stream, info) => {
      seen = true;
      const originalName = safeOriginalName(info.filename);
      const extension = extname(originalName).toLowerCase();
      if (!allowedExtensions.has(extension)) {
        pendingError = statusError(415, `Unsupported upload extension: ${extension || "none"}.`);
        stream.resume();
        return;
      }
      const sourceId = `source_${randomBytes(18).toString("base64url")}`;
      const storedName = `${sourceId}${extension}`;
      storedPath = join(uploadRoot, storedName);
      const output = createWriteStream(storedPath, { flags: "wx", mode: 0o600 });
      let byteSize = 0;
      stream.on("data", (chunk: Buffer) => { byteSize += chunk.length; });
      stream.on("limit", () => { tooLarge = true; });
      writeFinished = new Promise<void>((done, fail) => {
        output.on("finish", done);
        output.on("error", fail);
        stream.on("error", fail);
      });
      stream.pipe(output);
      result = { sourceId, absolutePath: storedPath, originalName, mediaType: info.mimeType || "application/octet-stream", byteSize, storedName };
      output.on("finish", () => { if (result) result.byteSize = byteSize; });
    });
    parser.on("error", (error) => { pendingError = error; });
    parser.on("finish", async () => {
      try {
        if (writeFinished) await writeFinished;
        if (tooLarge) pendingError = statusError(413, `Upload exceeds ${limit} bytes.`);
        if (pendingError) {
          if (storedPath) { try { unlinkSync(storedPath); } catch { /* already absent */ } }
          reject(pendingError);
          return;
        }
        if (!seen || !result) { reject(statusError(400, "Exactly one upload file is required.")); return; }
        resolve(result);
      } catch (error) {
        if (storedPath) { try { unlinkSync(storedPath); } catch { /* already absent */ } }
        reject(error);
      }
    });
    request.pipe(parser);
  });
}

export async function startWizardSession(options: WizardSessionOptions): Promise<WizardSessionHandle> {
  const token = randomBytes(32).toString("base64url");
  const uploadRoot = mkdtempSync(join(tmpdir(), "novel-forge-wizard-"));
  const sources = new Map<string, WizardSource>();
  const idleTimeoutMs = options.idleTimeoutMs ?? 15 * 60 * 1000;
  const uploadLimitBytes = options.uploadLimitBytes ?? 100 * 1024 * 1024;
  let origin = "";
  let idleTimer: NodeJS.Timeout | null = null;
  let closed = false;

  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const requestUrl = new URL(request.url ?? "/", origin || "http://127.0.0.1");
    const file = staticPath(requestUrl.pathname);
    if (file && request.method === "GET") {
      try { sendText(response, 200, contentType(file), readFileSync(file, "utf8")); }
      catch { sendJson(response, 404, { error: "Wizard asset not found." }); }
      return;
    }
    if (!requestUrl.pathname.startsWith("/api/")) { sendJson(response, 404, { error: "Not found." }); return; }
    if (!requireApiAuthorization(request, response, token, origin)) return;
    touch();
    try {
      if (requestUrl.pathname === "/api/session" && request.method === "GET") {
        sendJson(response, 200, { workflow: options.workflow ?? null, idle_timeout_ms: idleTimeoutMs });
        return;
      }
      if (requestUrl.pathname === "/api/upload" && request.method === "POST") {
        const uploaded = await receiveUpload(request, uploadRoot, uploadLimitBytes);
        const source: WizardSource = { sourceId: uploaded.sourceId, absolutePath: uploaded.absolutePath, originalName: uploaded.originalName, mediaType: uploaded.mediaType, byteSize: uploaded.byteSize };
        sources.set(source.sourceId, source);
        sendJson(response, 201, { source_id: source.sourceId, original_name: source.originalName, media_type: source.mediaType, byte_size: source.byteSize });
        return;
      }
      if (requestUrl.pathname === "/api/close" && request.method === "POST") {
        sendJson(response, 200, { closed: true });
        setImmediate(() => { void close(); });
        return;
      }
      const body = await readJson(request);
      if (requestUrl.pathname === "/api/snapshot" && request.method === "POST") {
        const value = body as Record<string, unknown>;
        sendJson(response, 200, await options.registry.snapshot(workflow(value.workflow)));
        return;
      }
      if (requestUrl.pathname === "/api/preview" && request.method === "POST") {
        const value = body as Record<string, unknown>;
        if (typeof value.action !== "string") throw statusError(400, "Preview action is required.");
        sendJson(response, 200, await options.registry.preview(workflow(value.workflow), value.action, value.payload));
        return;
      }
      if (requestUrl.pathname === "/api/apply" && request.method === "POST") {
        const envelope = body as WizardProposalEnvelope;
        if (!envelope || typeof envelope.proposal_id !== "string" || typeof envelope.action !== "string") throw statusError(400, "A typed wizard proposal envelope is required.");
        workflow(envelope.workflow);
        sendJson(response, 200, await options.registry.apply(envelope));
        return;
      }
      sendJson(response, 404, { error: "Unknown wizard route." });
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode: number }).statusCode) : 500;
      sendJson(response, statusCode, { error: error instanceof Error ? error.message : "Wizard request failed." });
    }
  });

  function touch(): void {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { void close(); }, idleTimeoutMs);
    idleTimer.unref?.();
  }

  async function close(): Promise<void> {
    if (closed) return;
    closed = true;
    if (idleTimer) clearTimeout(idleTimer);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(uploadRoot, { recursive: true, force: true });
    sources.clear();
  }

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolve(); });
  });
  const address = server.address() as AddressInfo;
  origin = `http://127.0.0.1:${address.port}`;
  const url = `${origin}/#token=${encodeURIComponent(token)}${options.workflow ? `&workflow=${encodeURIComponent(options.workflow)}` : ""}`;
  touch();
  if (options.openBrowser !== false) await openWizardBrowser(url);

  return {
    url,
    port: address.port,
    token,
    uploadRoot,
    resolveSource(sourceId: string) { return sources.get(sourceId) ?? null; },
    close,
  };
}
