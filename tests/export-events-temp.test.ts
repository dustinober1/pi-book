import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("temporary event source export", () => {
  const content = readFileSync(join(process.cwd(), "src", "application", "events.ts"), "utf8");
  console.log(`EVENTS_SOURCE_BASE64_BEGIN${Buffer.from(content, "utf8").toString("base64")}EVENTS_SOURCE_BASE64_END`);
});
