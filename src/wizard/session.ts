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

const workflows = new Set<WizardWorkflow>(["adoption", "readers", "packaging", "next-book", "research"]);
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

async function upload(req: IncomingMessage, uploadRoot: string, limit: number): Promise<WizardSource> {
  return new Promise((resolve, reject) => {
    const parser = Busboy({ headers: req.headers, limits: { files: 1, fileSize: limit, fields: 4 } });
    let record: WizardSource | null = null;
    let rejected = false;
    parser.on("file", (_name, stream, info) => {
      const extension = extname(info.filename).toLowerCase();
      if (!allowedExtensions.has(extension)) { rejected = true; stream.resume(); reject(statusError(415, `Unsupported upload type ${extension || "unknown"}.`)); return; }
      const sourceId = `upload-${randomBytes(12).toString("hex")}`;
      const absolutePath = join(uploadRoot, `${sourceId}${extension}`);
      let size = 0;
      stream.on("data", (chunk: Buffer) => { size += chunk.length; });
      stream.on("limit", () => { rejected = true; unlinkSync(absolutePath); reject(statusError(413, "Upload exceeds the session size limit.")); });
      stream.pipe(createWriteStream(absolutePath));
      stream.on("end", () => {
        if (rejected) return;
        record = { sourceId, absolutePath, originalName: basename(info.filename), mediaType: info.mimeType, byteSize: size };
      });
    });
    parser.on("error", reject);
    parser.on("finish", () => { if (!rejected && record) resolve(record); else if (!rejected) reject(statusError(400, "No upload file received.")); });
    req.pipe(parser);
  });
}

export async function startWizardSession(options: WizardSessionOptions): Promise<WizardSessionHandle> {
  const token = randomBytes(32).toString("base64url");
  const uploadRoot = mkdtempSync(join(tmpdir(), "novel-forge-wizard-"));
  const sources = new Map<string, WizardSource>();
  for (const initial of options.initialSources ?? []) {
    const sourceId = `authorized-${randomBytes(12).toString("hex")}`;
    sources.set(sourceId, { sourceId, absolutePath: initial.absolutePath, originalName: initial.originalName ?? basename(initial.absolutePath), mediaType: initial.mediaType ?? "application/octet-stream", byteSize: 0 });
  }
  const idleTimeoutMs = options.idleTimeoutMs ?? 15 * 60 * 1000;
  const uploadLimitBytes = options.uploadLimitBytes ?? 50 * 1024 * 1024;
  let lastActivity = Date.now();
  let closed = false;
  let timer: ReturnType<typeof setInterval>;
  let origin = "";

  const server = createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url ?? "/", origin || "http://127.0.0.1");
      const file = staticPath(requestUrl.pathname);
      if (req.method === "GET" && file) { sendText(res, 200, readFileSync(file, "utf8"), contentType(file)); return; }
      requireApiAuthorization(req, token, origin);
      lastActivity = Date.now();
      if (req.method === "POST" && requestUrl.pathname === "/api/session") {
        sendJson(res, 200, { workflow: options.workflow ?? null, project: options.projectRoot, expires_at: new Date(lastActivity + idleTimeoutMs).toISOString() });
        return;
      }
      if (req.method === "POST" && requestUrl.pathname === "/api/snapshot") {
        const body = await readJson(req) as { workflow?: unknown };
        sendJson(res, 200, await options.registry.snapshot(workflow(body.workflow ?? options.workflow)));
        return;
      }
      if (req.method === "POST" && requestUrl.pathname === "/api/preview") {
        const body = await readJson(req) as { workflow?: unknown; action?: unknown; payload?: unknown };
        if (typeof body.action !== "string" || !body.action) throw statusError(400, "Preview action is required.");
        sendJson(res, 200, await options.registry.preview(workflow(body.workflow ?? options.workflow), body.action, body.payload));
        return;
      }
      if (req.method === "POST" && requestUrl.pathname === "/api/apply") {
        const body = await readJson(req) as WizardProposalEnvelope;
        body.workflow = workflow(body.workflow ?? options.workflow);
        sendJson(res, 200, await options.registry.apply(body));
        return;
      }
      if (req.method === "POST" && requestUrl.pathname === "/api/upload") {
        const record = await upload(req, uploadRoot, uploadLimitBytes);
        sources.set(record.sourceId, record);
        sendJson(res, 200, { source_id: record.sourceId, original_name: record.originalName, media_type: record.mediaType, byte_size: record.byteSize });
        return;
      }
      if (req.method === "POST" && requestUrl.pathname === "/api/close") { sendJson(res, 200, { closing: true }); setImmediate(() => void close()); return; }
      throw statusError(404, "Wizard endpoint not found.");
    } catch (error) {
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error ? Number((error as { statusCode: number }).statusCode) : 500;
      sendJson(res, statusCode, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", () => resolve()); });
  const address = server.address() as AddressInfo;
  origin = `http://127.0.0.1:${address.port}`;
  const url = `${origin}/#token=${encodeURIComponent(token)}`;

  async function close(): Promise<void> {
    if (closed) return;
    closed = true;
    clearInterval(timer);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(uploadRoot, { recursive: true, force: true });
  }

  timer = setInterval(() => { if (Date.now() - lastActivity > idleTimeoutMs) void close(); }, Math.min(idleTimeoutMs, 30_000));
  timer.unref?.();
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
