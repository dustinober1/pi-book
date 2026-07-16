import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { requireProjectRoot } from "../project/store.js";
import { runExplicitVoiceRecalibration } from "../application/recalibration.js";
import { registerNovelForge } from "./extension.js";

type CommandDefinition = Parameters<ExtensionAPI["registerCommand"]>[1];

type Completion = { value: string; label: string; description?: string };

interface ReviewCommandDefinition {
  description?: string;
  getArgumentCompletions?: (prefix: string) => Completion[] | null;
  handler: (args: string, context: ExtensionCommandContext) => Promise<void> | void;
  [key: string]: unknown;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function withRecalibration(definition: CommandDefinition): CommandDefinition {
  const original = definition as unknown as ReviewCommandDefinition;
  const decorated: ReviewCommandDefinition = {
    ...original,
    description: "Review a chapter, act, manuscript, series, or explicit voice recalibration",
    getArgumentCompletions(prefix: string): Completion[] | null {
      const existing = original.getArgumentCompletions?.(prefix) ?? [];
      const items = [...existing];
      if ("recalibration".startsWith(prefix) && !items.some((item) => item.value === "recalibration")) {
        items.push({ value: "recalibration", label: "recalibration", description: "Record a state-neutral voice recalibration audit" });
      }
      return items.length ? items : null;
    },
    async handler(args: string, context: ExtensionCommandContext): Promise<void> {
      const scope = args.trim().split(/\s+/)[0] || "act";
      if (scope !== "recalibration") {
        await original.handler(args, context);
        return;
      }
      try {
        const root = requireProjectRoot(context.cwd);
        const result = runExplicitVoiceRecalibration(root);
        context.ui.notify(`Voice recalibration recorded. Stage remains ${result.stage}.`, "info");
      } catch (error) {
        context.ui.notify(errorText(error), "warning");
      }
    },
  };
  return decorated as unknown as CommandDefinition;
}

export function registerNovelForgeWithRecalibration(pi: ExtensionAPI): void {
  const registerCommand = pi.registerCommand.bind(pi);
  const proxy = new Proxy(pi as object, {
    get(target, property, receiver) {
      if (property === "registerCommand") {
        return (name: string, definition: CommandDefinition): void => {
          registerCommand(name, name === "novel-review" ? withRecalibration(definition) : definition);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(pi) : value;
    },
  }) as ExtensionAPI;
  registerNovelForge(proxy);
}
