import { appendFileSync } from "node:fs";

const args = process.argv.slice(2);
const capture = process.env.FAKE_PI_CAPTURE;

function record(value) {
  if (capture) appendFileSync(capture, `${JSON.stringify(value)}\n`, "utf8");
}

if (args.includes("--list-models")) {
  record({ kind: "models", args });
  process.stdout.write([
    "provider  model          context  max-out  thinking  images",
    "fake      quality-model  128K     32K      yes       no",
    "",
  ].join("\n"));
  process.exit(0);
}

let stdin = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) stdin += chunk;
record({ kind: "run", args, stdin });

if (stdin.includes("NONZERO_EXIT")) {
  process.stderr.write("private fake failure\n");
  process.exit(7);
}
if (stdin.includes("WAIT_FOREVER")) {
  setInterval(() => {}, 1_000);
  await new Promise(() => {});
}
if (stdin.includes("MISSING_FINAL")) {
  process.stdout.write(`${JSON.stringify({ type: "agent_start" })}\n`);
  process.exit(0);
}

const message = {
  role: "assistant",
  content: [{ type: "text", text: "worker result" }],
  api: "openai-responses",
  provider: "fake",
  model: "quality-model",
  usage: {
    input: 700,
    output: 200,
    cacheRead: 100,
    cacheWrite: 20,
    reasoning: 50,
    totalTokens: 1_020,
    cost: { input: 0.001, output: 0.002, cacheRead: 0.0001, cacheWrite: 0.00002, total: 0.00312 },
  },
  stopReason: "stop",
  timestamp: Date.now(),
};

for (const event of [
  { type: "session", version: 3, id: "fake", timestamp: new Date().toISOString(), cwd: process.cwd() },
  { type: "agent_start" },
  { type: "message_end", message },
  { type: "agent_end", messages: [message] },
]) process.stdout.write(`${JSON.stringify(event)}\n`);
