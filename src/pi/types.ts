export interface PiUi {
  input(prompt: string, placeholder?: string): Promise<string | undefined>;
  select(prompt: string, options: string[]): Promise<string | undefined>;
  confirm(prompt: string, detail?: string): Promise<boolean>;
  editor(prompt: string, initial?: string): Promise<string | undefined>;
  notify(message: string, level?: "info" | "warning" | "error"): void;
}

export interface PiCommandContext {
  cwd: string;
  ui: PiUi;
  isIdle(): boolean;
}

export interface PiCommandDefinition {
  description: string;
  getArgumentCompletions?: (prefix: string) => Array<{ value: string; label: string }> | null;
  handler(args: string, context: PiCommandContext): Promise<void> | void;
}

export interface PiExtensionApi {
  registerCommand(name: string, definition: PiCommandDefinition): void;
  sendUserMessage(message: string, options?: { deliverAs?: "followUp" }): void;
}
