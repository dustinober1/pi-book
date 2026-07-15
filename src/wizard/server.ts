import type { IncomingMessage, ServerResponse } from "node:http";

export function sendJson(response: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(body);
}

export function sendText(response: ServerResponse, status: number, contentType: string, body: string): void {
  response.writeHead(status, {
    "content-type": contentType,
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data: blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  });
  response.end(body);
}

export async function readJson(request: IncomingMessage, maximumBytes = 1_048_576): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maximumBytes) throw Object.assign(new Error("Request body is too large."), { statusCode: 413 });
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 }); }
}

export function requireApiAuthorization(request: IncomingMessage, response: ServerResponse, token: string, origin: string): boolean {
  if (request.headers.authorization !== `Bearer ${token}`) {
    sendJson(response, 401, { error: "Unauthorized." });
    return false;
  }
  const browserOrigin = request.headers.origin;
  const declaredOrigin = request.headers["x-novel-forge-origin"];
  if ((browserOrigin !== undefined && browserOrigin !== origin) || declaredOrigin !== origin) {
    sendJson(response, 403, { error: "Unexpected request origin." });
    return false;
  }
  return true;
}
