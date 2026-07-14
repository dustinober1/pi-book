import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import YAML from "yaml";
import { ChapterPacketSchema, GenreConfigSchema, PlotGridSchema, ProfileIdSchema, assertSchema, type ChapterPacket, type GenreConfig, type PlotGridState, type ProfileId } from "../src/domain/schemas.js";
import { countWords } from "../src/infrastructure/files.js";
import { getProfile } from "../src/profiles/index.js";
import { regressionChecklist, synthesizeTickets, type ReviewFinding } from "../src/review/review.js";

interface Fixture {
  schema_version: "1.0.0";
  profile: ProfileId;
  project_type: "standalone" | "series";
  genre: GenreConfig;
  packet: ChapterPacket;
  plot: PlotGridState;
  sample_chapter: string;
  review_finding: ReviewFinding;
}

const root = resolve(process.cwd(), "evals");
const names = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name !== "rubrics").map((entry) => entry.name).sort();
let failures = 0;
console.log("# Novel Forge architecture and revision evaluation\n");
for (const name of names) {
  const fixture = YAML.parse(readFileSync(join(root, name, "fixture.yaml"), "utf8")) as Fixture;
  const errors: string[] = [];
  try {
    assertSchema(ProfileIdSchema, fixture.profile, `${name} profile`);
    assertSchema(GenreConfigSchema, fixture.genre, `${name} genre`);
    assertSchema(ChapterPacketSchema, fixture.packet, `${name} packet`);
    assertSchema(PlotGridSchema, fixture.plot, `${name} plot`);
    const profile = getProfile(fixture.profile);
    const findings = [...profile.validateGenreConfig(fixture.genre), ...profile.validatePacket(fixture.packet), ...profile.validatePlot(fixture.plot)];
    errors.push(...findings.filter((finding) => ["blocker", "high"].includes(finding.severity)).map((finding) => finding.message));
    if (!fixture.plot.chapters.some((chapter) => chapter.chapter === fixture.packet.chapter)) errors.push("packet chapter is missing from plot grid");
    if (countWords(fixture.sample_chapter) < 45) errors.push("sample chapter is too short for a useful fixture");
    if (profile.milestoneReviewLanes.length < 6) errors.push("profile has too few independent review lanes");
    const tickets = synthesizeTickets({ schema_version: "1.0.0", tickets: [] }, [fixture.review_finding], 1);
    if (tickets.tickets.length !== 1) errors.push("review finding did not synthesize into one ticket");
    else if (regressionChecklist(tickets.tickets[0]!).length <= fixture.review_finding.acceptanceTests.length) errors.push("regression protections were not added to the ticket");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  console.log(`- ${name}: ${errors.length ? `FAIL (${errors.join("; ")})` : "PASS"}`);
  failures += errors.length ? 1 : 0;
}
console.log(`\n${names.length - failures}/${names.length} fixtures passed.`);
if (failures) process.exitCode = 1;
