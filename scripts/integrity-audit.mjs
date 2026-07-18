import { forwardProseLint } from "./lib/prose-lint-forwarder.mjs";

forwardProseLint({
  title: "Novel Forge structured-integrity audit",
  rulePrefixes: [
    "consistency/chapter-sequence",
    "consistency/duplicate-id",
    "consistency/relationship-characters",
    "consistency/missing-reference",
    "consistency/thread-status",
  ],
});
