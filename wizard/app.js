const parameters = new URLSearchParams(location.hash.slice(1));
const token = parameters.get("token") || "";
let activeWorkflow = parameters.get("workflow") || "";

const snapshot = document.querySelector("#snapshot");
const result = document.querySelector("#proposal-result");
const title = document.querySelector("#workflow-title");
const label = document.querySelector("#workflow-label");
const content = document.querySelector("#workflow-content");
const summary = document.querySelector("#session-summary");

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({ error: "Unreadable response" }));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

function pretty(value) { return JSON.stringify(value, null, 2); }

async function selectWorkflow(workflow) {
  activeWorkflow = workflow;
  document.querySelectorAll("[data-workflow]").forEach((button) => button.classList.toggle("active", button.dataset.workflow === workflow));
  const names = { adoption: "Existing-project adoption", readers: "Reader evidence", packaging: "Packaging checklist", "next-book": "Next-book inheritance" };
  label.textContent = "Guided review";
  title.textContent = names[workflow] || "Workflow";
  content.innerHTML = `<p>Review the structured snapshot, prepare a preview, and submit only a confirmed proposal. No browser action writes files directly.</p>`;
  try {
    const state = await api("/api/snapshot", { method: "POST", body: JSON.stringify({ workflow }) });
    snapshot.textContent = pretty(state);
  } catch (error) {
    snapshot.textContent = error.message;
  }
}

for (const button of document.querySelectorAll("[data-workflow]")) {
  button.addEventListener("click", () => selectWorkflow(button.dataset.workflow));
}

document.querySelector("#preview-proposal").addEventListener("click", async () => {
  result.textContent = "Preparing preview…";
  try {
    const action = document.querySelector("#proposal-action").value.trim();
    const payload = JSON.parse(document.querySelector("#proposal-payload").value || "{}");
    result.textContent = pretty(await api("/api/preview", { method: "POST", body: JSON.stringify({ workflow: activeWorkflow, action, payload }) }));
  } catch (error) { result.textContent = error.message; }
});

document.querySelector("#apply-proposal").addEventListener("click", async () => {
  if (!confirm("Apply this proposal through Novel Forge's guarded transaction engine?")) return;
  result.textContent = "Applying…";
  try {
    const action = document.querySelector("#proposal-action").value.trim();
    const payload = JSON.parse(document.querySelector("#proposal-payload").value || "{}");
    const envelope = {
      proposal_id: crypto.randomUUID(),
      workflow: activeWorkflow,
      action,
      expected_stage: payload.expected_stage || "",
      expected_project_hash: payload.expected_project_hash || "",
      payload,
    };
    result.textContent = pretty(await api("/api/apply", { method: "POST", body: JSON.stringify(envelope) }));
    await selectWorkflow(activeWorkflow);
  } catch (error) { result.textContent = error.message; }
});

document.querySelector("#close-session").addEventListener("click", async () => {
  try { await api("/api/close", { method: "POST", body: "{}" }); } catch {}
  document.body.innerHTML = '<main class="closed"><h1>Wizard closed</h1><p>You may close this tab.</p></main>';
});

(async () => {
  if (!token) {
    summary.textContent = "This wizard URL has no session credential. Launch it again from /novel.";
    return;
  }
  try {
    const session = await api("/api/session");
    summary.textContent = `Connected to a loopback-only session. Idle timeout: ${Math.round(session.idle_timeout_ms / 60000)} minutes.`;
    if (activeWorkflow) await selectWorkflow(activeWorkflow);
  } catch (error) {
    summary.textContent = error.message;
  }
})();
