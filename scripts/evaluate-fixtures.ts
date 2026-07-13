import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import YAML from "yaml";
import { ChapterPacketSchema, ProfileIdSchema, assertSchema, type ChapterPacket, type ProfileId } from "../src/domain/schemas.js";
import { getProfile } from "../src/profiles/index.js";

interface Fixture { schema_version: "1.0.0"; profile: ProfileId; packet: ChapterPacket }
const root = resolve(process.cwd(), "evals");
const names = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
let failures = 0;
console.log("# Novel Forge fixture evaluation\n");
for (const name of names) {
  const value = YAML.parse(readFileSync(join(root, name, "fixture.yaml"), "utf8")) as Fixture;
  assertSchema(ProfileIdSchema, value.profile, `${name} profile`);
  assertSchema(ChapterPacketSchema, value.packet, `${name} packet`);
  const findings = getProfile(value.profile).validatePacket(value.packet);
  const blockers = findings.filter((finding) => finding.severity === "blocker");
  console.log(`- ${name}: ${blockers.length ? `FAIL (${blockers.map((item) => item.message).join("; ")})` : "PASS"}`);
  failures += blockers.length ? 1 : 0;
}
console.log(`\n${names.length - failures}/${names.length} fixtures passed.`);
if (failures) process.exitCode = 1;
