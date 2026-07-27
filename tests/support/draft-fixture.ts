/**
 * Chapter drafts are validated against their packet's `target_words`, so a
 * fixture draft has to be a plausible length for the packet it answers. These
 * helpers keep that from meaning thousands of words of literal prose in test
 * files.
 */
import { execFileSync } from "node:child_process";

const SENTENCE = "The keeper crossed the yard and counted the seals against the tally he carried in his head.";

/**
 * Commits fixture scaffolding written directly to the project tree. Real
 * projects reach that state through applied events, which checkpoint as they
 * go; a test that hand-writes canonical files leaves them uncommitted, which
 * the working-tree guard correctly reads as an out-of-band write.
 */
export function commitFixture(root: string, message = "test fixture"): void {
  const git = (args: string[]) => execFileSync("git", args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  git(["add", "-A"]);
  git(["-c", "user.name=Fixture", "-c", "user.email=fixture@localhost", "commit", "--no-verify", "-m", message]);
}

/** Produces deterministic filler prose of approximately `words` words. */
export function draftText(title: string, words: number): string {
  const heading = `# ${title}`;
  const perSentence = SENTENCE.split(/\s+/).length;
  const remaining = Math.max(0, words - heading.split(/\s+/).length);
  const sentences = Math.max(1, Math.round(remaining / perSentence));
  const body: string[] = [];
  for (let index = 0; index < sentences; index += 1) {
    body.push(SENTENCE);
    if (index % 5 === 4) body.push("\n\n");
  }
  return `${heading}\n\n${body.join(" ").replace(/ \n\n /g, "\n\n")}\n`;
}

/** Produces a draft sized to sit inside the accepted band for `targetWords`. */
export function draftForTarget(title: string, targetWords: number): string {
  return draftText(title, Math.round(targetWords * 0.95));
}

/**
 * Extends an existing fixture draft to a plausible length for its packet while
 * leaving the original text — which tests assert on — first and intact.
 */
export function padDraft(content: string, targetWords: number): string {
  const have = content.trim().split(/\s+/).filter(Boolean).length;
  const want = Math.round(targetWords * 0.95);
  if (have >= want) return content;
  return `${content.trimEnd()}\n\n${draftText("Continued", want - have).split("\n").slice(2).join("\n")}`;
}
