import { forwardProseLint } from "./lib/prose-lint-forwarder.mjs";

forwardProseLint({ title: "Novel Forge spelling-consistency audit", rulePrefixes: ["consistency/spelling"], legacyReport: "spelling" });
