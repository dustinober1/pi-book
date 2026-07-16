const parameters = new URLSearchParams(location.hash.slice(1));
const token = parameters.get("token") || "";
let activeWorkflow = parameters.get("workflow") || "";
let currentSnapshot = null;
let currentPreview = null;

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
      "X-Novel-Forge-Origin": location.origin,
      ...(options.body instanceof FormData ? {} : { "content-type": "application/json" }),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({ error: "Unreadable response" }));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

async function upload(file) {
  const form = new FormData();
  form.set("file", file);
  return api("/api/upload", { method: "POST", body: form });
}

function pretty(value) { return JSON.stringify(value, null, 2); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]); }
function setResult(value, error = false) { result.textContent = typeof value === "string" ? value : pretty(value); result.classList.toggle("error", error); }
function fieldValue(id) { return document.querySelector(`#${id}`)?.value ?? ""; }
function checked(id) { return Boolean(document.querySelector(`#${id}`)?.checked); }
function selectedValues(selector) { return [...document.querySelectorAll(selector)].filter((input) => input.checked).map((input) => input.value); }

function envelope(action, payload) {
  if (!currentSnapshot) throw new Error("Reload the workflow snapshot before applying changes.");
  return {
    proposal_id: crypto.randomUUID(),
    workflow: activeWorkflow,
    action,
    expected_stage: currentSnapshot.project.stage,
    expected_project_hash: currentSnapshot.project.state_hash,
    payload,
  };
}

async function applyAction(action, payload) {
  if (!confirm("Apply this proposal through Novel Forge's guarded transaction engine?")) return null;
  const response = await api("/api/apply", { method: "POST", body: JSON.stringify(envelope(action, payload)) });
  setResult(response);
  await loadSnapshot();
  return response;
}

function sectionCard(section, index) {
  return `<article class="mapping-card" data-section-id="${escapeHtml(section.id)}">
    <div class="mapping-order"><button type="button" data-move="up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-move="down">↓</button></div>
    <label>Include <input type="checkbox" data-field="included" ${section.included ? "checked" : ""}></label>
    <label>Title <input data-field="title" value="${escapeHtml(section.title)}"></label>
    <label>Number <input data-field="number" type="number" min="1" value="${section.number ?? ""}"></label>
    <label>Classification <select data-field="kind">${["front-matter","chapter","interlude","appendix","back-matter"].map((kind) => `<option ${kind === section.kind ? "selected" : ""}>${kind}</option>`).join("")}</select></label>
    <p>${section.wordCount} words · ${escapeHtml(section.sourceRefs.join(", "))}</p>
  </article>`;
}

function adoptionForm() {
  content.innerHTML = `<div class="wizard-stack">
    <section class="card"><h3>1. Select source</h3><p>Upload DOCX, EPUB, Markdown, or text. A chapter-directory path may be authorized from the Pi command.</p><input id="adoption-file" type="file" accept=".docx,.epub,.md,.txt"><label><input id="prefer-pandoc" type="checkbox" checked> Prefer Pandoc when available</label><button id="discover-adoption">Discover manuscript</button></section>
    <section id="adoption-preview" class="card hidden"><h3>2. Review chapter and asset map</h3><div id="adoption-warnings"></div><div id="adoption-sections" class="mapping-list"></div><div id="adoption-assets"></div><div id="adoption-metadata"></div><button id="validate-adoption" class="secondary">Validate mapping</button><button id="apply-adoption" class="danger">Adopt reviewed manuscript</button></section>
  </div>`;
  document.querySelector("#discover-adoption").addEventListener("click", async () => {
    try {
      const file = document.querySelector("#adoption-file").files[0];
      if (!file) throw new Error("Choose a manuscript file first.");
      setResult("Uploading and inspecting the source…");
      const source = await upload(file);
      currentPreview = await api("/api/preview", { method: "POST", body: JSON.stringify({ workflow: "adoption", action: "discover", payload: { source: { kind: "upload", source_id: source.source_id }, prefer_pandoc: checked("prefer-pandoc") } }) });
      renderAdoptionPreview();
      setResult({ source: currentPreview.source, engine: currentPreview.engine, sections: currentPreview.sections.length, assets: currentPreview.assets.length });
    } catch (error) { setResult(error.message, true); }
  });
}

function renderAdoptionPreview() {
  document.querySelector("#adoption-preview").classList.remove("hidden");
  document.querySelector("#adoption-warnings").innerHTML = currentPreview.warnings.length ? `<ul class="warnings">${currentPreview.warnings.map((warning) => `<li>${escapeHtml(warning.message)}</li>`).join("")}</ul>` : "<p>No conversion warnings.</p>";
  document.querySelector("#adoption-sections").innerHTML = currentPreview.sections.map(sectionCard).join("");
  document.querySelector("#adoption-assets").innerHTML = `<h4>Assets</h4>${currentPreview.assets.length ? currentPreview.assets.map((asset) => `<div class="asset-row" data-asset-id="${escapeHtml(asset.id)}"><strong>${escapeHtml(asset.originalName)}</strong><label>Caption <input data-field="caption" value="${escapeHtml(asset.caption)}"></label><label>Alt text <input data-field="altText" value="${escapeHtml(asset.altText)}"></label></div>`).join("") : "<p>No embedded assets.</p>"}`;
  document.querySelector("#adoption-metadata").innerHTML = `<h4>Discovered metadata</h4>${Object.entries(currentPreview.metadataCandidates).map(([key, value]) => `<div class="metadata-row" data-metadata-key="${escapeHtml(key)}"><strong>${escapeHtml(key)}</strong><span>${escapeHtml(value)}</span><select data-field="action"><option value="accept">Accept</option><option value="edit">Edit</option><option value="ignore">Ignore</option></select><input data-field="value" value="${escapeHtml(value)}"></div>`).join("") || "<p>No metadata candidates.</p>"}`;
  for (const button of document.querySelectorAll("[data-move]")) button.addEventListener("click", () => {
    const card = button.closest(".mapping-card");
    if (button.dataset.move === "up" && card.previousElementSibling) card.parentElement.insertBefore(card, card.previousElementSibling);
    if (button.dataset.move === "down" && card.nextElementSibling) card.parentElement.insertBefore(card.nextElementSibling, card);
  });
  document.querySelector("#validate-adoption").addEventListener("click", () => previewAdoptionMapping());
  document.querySelector("#apply-adoption").addEventListener("click", async () => {
    try { await applyAction("adopt", { preview_id: currentPreview.previewId, mapping: adoptionMapping() }); }
    catch (error) { setResult(error.message, true); }
  });
}

function adoptionMapping() {
  const operations = [];
  const original = new Map(currentPreview.sections.map((section) => [section.id, section]));
  const ordered = [...document.querySelectorAll(".mapping-card")];
  operations.push({ type: "reorder", sectionIds: ordered.map((card) => card.dataset.sectionId) });
  for (const card of ordered) {
    const section = original.get(card.dataset.sectionId);
    const title = card.querySelector('[data-field="title"]').value;
    const numberText = card.querySelector('[data-field="number"]').value;
    const kind = card.querySelector('[data-field="kind"]').value;
    const included = card.querySelector('[data-field="included"]').checked;
    if (title !== section.title) operations.push({ type: "rename", sectionId: section.id, title });
    if ((numberText ? Number(numberText) : null) !== section.number) operations.push({ type: "renumber", sectionId: section.id, number: numberText ? Number(numberText) : null });
    if (kind !== section.kind) operations.push({ type: "classify", sectionId: section.id, kind });
    if (included !== section.included) operations.push({ type: "exclude", sectionId: section.id, excluded: !included });
  }
  const assetEdits = [...document.querySelectorAll(".asset-row")].map((row) => ({ assetId: row.dataset.assetId, caption: row.querySelector('[data-field="caption"]').value, altText: row.querySelector('[data-field="altText"]').value }));
  const metadata = Object.fromEntries([...document.querySelectorAll(".metadata-row")].map((row) => [row.dataset.metadataKey, { action: row.querySelector('[data-field="action"]').value, value: row.querySelector('[data-field="value"]').value }]));
  return { operations, assetEdits, metadata };
}

async function previewAdoptionMapping() {
  try {
    const response = await api("/api/preview", { method: "POST", body: JSON.stringify({ workflow: "adoption", action: "map", payload: { preview_id: currentPreview.previewId, mapping: adoptionMapping() } }) });
    setResult(response.findings);
  } catch (error) { setResult(error.message, true); }
}

function readersForm() {
  content.innerHTML = `<div class="two-column">
    <section class="card"><h3>Create reader kit</h3><label>Scope <select id="reader-scope"><option>first-page</option><option>first-chapter</option><option>selected-chapters</option><option>act</option><option>excerpt</option><option>manuscript</option></select></label><label>Target segment <input id="reader-target" value="core target readers"></label><label>Minimum immediate <input id="reader-min-immediate" type="number" value="3"></label><label>Minimum delayed <input id="reader-min-delayed" type="number" value="3"></label><label>Follow-up hours <input id="reader-delay" type="number" value="48"></label><label>Variant <input id="reader-variant"></label><label><input id="reader-blind" type="checkbox"> Blind variant</label><button id="preview-kit">Preview kit</button><button id="create-kit" class="danger" disabled>Create kit</button></section>
    <section class="card"><h3>Import response CSV</h3><label>Experiment ID <input id="reader-experiment" value="RE-001"></label><input id="reader-csv" type="file" accept=".csv"><button id="preview-csv">Preview CSV</button><div id="reader-conflicts"></div><button id="import-csv" class="danger" disabled>Merge accepted rows</button><hr><button id="migrate-readers" class="secondary">Migrate v1.1 reader evidence</button></section>
  </div>`;
  let kitPreview = null;
  let importPreview = null;
  document.querySelector("#preview-kit").addEventListener("click", async () => {
    try {
      const proposal = { scope: fieldValue("reader-scope"), targetReader: fieldValue("reader-target"), minimumImmediateCount: Number(fieldValue("reader-min-immediate")), minimumDelayedCount: Number(fieldValue("reader-min-delayed")), delayedAfterHours: Number(fieldValue("reader-delay")), variant: fieldValue("reader-variant"), blind: checked("reader-blind") };
      kitPreview = await api("/api/preview", { method: "POST", body: JSON.stringify({ workflow: "readers", action: "kit", payload: { proposal } }) });
      document.querySelector("#create-kit").disabled = false;
      setResult({ sample_words: kitPreview.wordCount, source_paths: kitPreview.sourcePaths, sample_hash: kitPreview.sampleHash });
    } catch (error) { setResult(error.message, true); }
  });
  document.querySelector("#create-kit").addEventListener("click", async () => { try { await applyAction("create-kit", { preview_id: kitPreview.preview_id }); } catch (error) { setResult(error.message, true); } });
  document.querySelector("#preview-csv").addEventListener("click", async () => {
    try {
      const file = document.querySelector("#reader-csv").files[0];
      if (!file) throw new Error("Choose a CSV file first.");
      const source = await upload(file);
      importPreview = await api("/api/preview", { method: "POST", body: JSON.stringify({ workflow: "readers", action: "csv", payload: { experiment_id: fieldValue("reader-experiment"), source_id: source.source_id } }) });
      document.querySelector("#reader-conflicts").innerHTML = importPreview.rows.filter((row) => row.status === "conflict").map((row) => `<label>${escapeHtml(row.key)} <select data-conflict-key="${escapeHtml(row.key)}"><option value="keep-existing">Keep existing</option><option value="use-imported">Use imported</option><option value="exclude">Exclude</option></select></label>`).join("") || "<p>No conflicts.</p>";
      document.querySelector("#import-csv").disabled = false;
      setResult(importPreview.counts);
    } catch (error) { setResult(error.message, true); }
  });
  document.querySelector("#import-csv").addEventListener("click", async () => {
    try { const decisions = Object.fromEntries([...document.querySelectorAll("[data-conflict-key]")].map((select) => [select.dataset.conflictKey, select.value])); await applyAction("import-csv", { preview_id: importPreview.preview_id, decisions }); }
    catch (error) { setResult(error.message, true); }
  });
  document.querySelector("#migrate-readers").addEventListener("click", async () => { try { await applyAction("migrate-v1.1", {}); } catch (error) { setResult(error.message, true); } });
}

function packagingForm() {
  content.innerHTML = `<div class="wizard-stack"><section class="card"><h3>Packaging readiness</h3><div id="package-checklist"></div><button id="refresh-checklist" class="secondary">Refresh checklist</button></section><section class="card"><h3>Canonical metadata</h3><div class="two-column"><label>publishing.yaml JSON<textarea id="publishing-json" rows="18"></textarea></label><label>marketing.yaml JSON<textarea id="marketing-json" rows="18"></textarea></label></div><button id="save-metadata">Save canonical metadata</button></section><section class="card"><h3>Production package</h3><label><input id="package-pandoc" type="checkbox" checked> Prefer Pandoc when available</label><label><input id="package-regenerate" type="checkbox"> Regenerate stale outputs</label><button id="preview-artifacts">Preview outputs</button><button id="generate-package" class="danger">Generate complete package</button></section></div>`;
  const render = async () => {
    const checklist = await api("/api/preview", { method: "POST", body: JSON.stringify({ workflow: "packaging", action: "checklist", payload: {} }) });
    document.querySelector("#package-checklist").innerHTML = checklist.items.map((item) => `<div class="check-row ${item.complete ? "complete" : item.blocking ? "blocking" : "advisory"}"><strong>${item.complete ? "✓" : item.blocking ? "✗" : "○"} ${escapeHtml(item.label)}</strong><p>${escapeHtml(item.detail)}</p><small>Repair: ${escapeHtml(item.repairAction)}</small></div>`).join("");
    const metadata = await api("/api/preview", { method: "POST", body: JSON.stringify({ workflow: "packaging", action: "metadata", payload: {} }) });
    document.querySelector("#publishing-json").value = pretty(metadata.publishing);
    document.querySelector("#marketing-json").value = pretty(metadata.marketing);
  };
  render().catch((error) => setResult(error.message, true));
  document.querySelector("#refresh-checklist").addEventListener("click", () => render().catch((error) => setResult(error.message, true)));
  document.querySelector("#save-metadata").addEventListener("click", async () => { try { await applyAction("update-metadata", { publishing: JSON.parse(fieldValue("publishing-json")), marketing: JSON.parse(fieldValue("marketing-json")) }); } catch (error) { setResult(error.message, true); } });
  document.querySelector("#preview-artifacts").addEventListener("click", async () => { try { setResult(await api("/api/preview", { method: "POST", body: JSON.stringify({ workflow: "packaging", action: "artifacts", payload: { prefer_pandoc: checked("package-pandoc") } }) })); } catch (error) { setResult(error.message, true); } });
  document.querySelector("#generate-package").addEventListener("click", async () => { try { await applyAction("generate-package", { prefer_pandoc: checked("package-pandoc"), regenerate: checked("package-regenerate") }); } catch (error) { setResult(error.message, true); } });
}

function nextBookForm() {
  const proposal = currentSnapshot.workflow.proposal;
  if (proposal.eligible === false) { content.innerHTML = `<div class="empty-state"><p>${escapeHtml(proposal.reason)}</p></div>`; return; }
  content.innerHTML = `<div class="wizard-stack"><section class="card"><h3>Inherited context preview</h3><p>Previous: ${escapeHtml(proposal.previousBook)} — ${escapeHtml(proposal.previousTitle)}</p><p>Proposed: ${escapeHtml(proposal.bookId)}</p><h4>Locked canon</h4><div class="choice-list">${proposal.canon.map((fact) => `<label><input type="checkbox" data-canon value="${escapeHtml(fact.id)}"> ${escapeHtml(fact.id)} — ${escapeHtml(fact.fact)}</label>`).join("") || "<p>No locked facts.</p>"}</div><h4>Open threads</h4><div class="choice-list">${proposal.openThreads.map((thread) => `<div><label><input type="checkbox" data-thread value="${escapeHtml(thread.id)}"> Continue ${escapeHtml(thread.id)} — ${escapeHtml(thread.setup)}</label><label><input type="checkbox" data-deferred value="${escapeHtml(thread.id)}"> Defer</label></div>`).join("") || "<p>No open threads.</p>"}</div></section><section class="card"><h3>Author decisions</h3><label>Title <input id="next-title"></label><label>Series role <input id="next-role" value="${escapeHtml(proposal.seriesRole)}"></label><label>Relationship <select id="next-relationship"><option>direct-continuation</option><option>adjacent-story</option><option>prequel</option><option>later-installment</option><option>other</option></select></label><label>Profile <select id="next-profile"><option ${proposal.profile === "thriller" ? "selected" : ""}>thriller</option><option ${proposal.profile === "romantasy" ? "selected" : ""}>romantasy</option></select></label><label>Target words <input id="next-words" type="number" value="${proposal.targetWords}"></label><label>Protagonist / primary viewpoint <input id="next-protagonist"></label><label>Immutable facts (one per line)<textarea id="next-immutable"></textarea></label><label>Optional context (one per line)<textarea id="next-optional"></textarea></label><label>Excluded context (one per line)<textarea id="next-excluded"></textarea></label><button id="create-next-book" class="danger">Create next book</button></section></div>`;
  document.querySelector("#create-next-book").addEventListener("click", async () => {
    try {
      const lines = (id) => fieldValue(id).split("\n").map((value) => value.trim()).filter(Boolean);
      const decision = { title: fieldValue("next-title"), role: fieldValue("next-role"), relationship: fieldValue("next-relationship"), profile: fieldValue("next-profile"), targetWords: Number(fieldValue("next-words")), protagonist: fieldValue("next-protagonist"), inheritedCanonIds: selectedValues("[data-canon]"), continuingThreadIds: selectedValues("[data-thread]"), deferredThreadIds: selectedValues("[data-deferred]"), immutableFacts: lines("next-immutable"), optionalContext: lines("next-optional"), excludedContext: lines("next-excluded") };
      await applyAction("create", decision);
    } catch (error) { setResult(error.message, true); }
  });
}


function researchLines(id) { return fieldValue(id).split("\n").map((value) => value.trim()).filter(Boolean); }
function researchScore(id, fallback = 3) { const value = Number(fieldValue(id)); return Number.isFinite(value) ? value : fallback; }

function researchForm() {
  const data = currentSnapshot.workflow;
  const experiments = data.voice?.experiments || [];
  const observations = data.friction?.observations || [];
  const clusters = data.friction?.clusters || [];
  const items = data.research?.items || [];
  const candidates = (data.learning?.candidates || []).filter((candidate) => candidate.eligible);
  content.innerHTML = `<div class="research-grid">
    <section class="card"><h3>Influence Palette</h3><p class="evidence-note">Names stay in private taste evidence. Drafting receives only neutral traits.</p><label>Reference <input id="research-influence-reference" placeholder="Author or book reference"></label><label>Role <select id="research-influence-type"><option>voice</option><option>reader-experience</option><option>structure</option><option>characterization</option><option>atmosphere</option><option>market-position</option></select></label><label>Admired qualities, one per line<textarea id="research-admired" rows="4"></textarea></label><label>Explicitly excluded qualities<textarea id="research-excluded" rows="4"></textarea></label><label>Neutral derived craft traits<textarea id="research-traits" rows="4"></textarea></label><div class="button-row"><button id="preview-influence">Preview</button><button id="apply-influence" class="danger" disabled>Save influence</button></div></section>
    <section class="card"><h3>Anonymous Voice Comparison</h3><p>Variants are shown only as A, B, and C. Scores summarize evidence but never choose prose automatically.</p><label>Experiment <select id="research-experiment">${experiments.map((experiment) => `<option value="${escapeHtml(experiment.id)}">${escapeHtml(experiment.id)} — ${escapeHtml(experiment.status)}</option>`).join("")}</select></label><button id="preview-voice">Load A/B/C</button><div id="research-variants" class="variant-grid"></div><label>Accepted traits, one per line<textarea id="research-accepted-traits" rows="3"></textarea></label><label>Baseline choice <select id="research-baseline-choice"><option>A</option><option>B</option><option>C</option><option>custom</option></select></label><label>Custom combined baseline<textarea id="research-custom-baseline" rows="6"></textarea></label><div class="button-row"><button id="save-voice-scores" disabled>Save scores</button><button id="accept-voice-baseline" class="danger" disabled>Accept baseline</button></div></section>
    <section class="card wide"><h3>Reader Friction</h3><p class="evidence-note">Public market evidence is separate from real manuscript reader evidence. Reviewer identity is removed before storage.</p><div class="two-column"><div><label>Review CSV <input id="research-review-file" type="file" accept=".csv"></label><label>Or paste CSV<textarea id="research-review-csv" rows="7"></textarea></label><div class="button-row"><button id="preview-review-csv">Preview identity-safe import</button><button id="apply-review-csv" class="danger" disabled>Import observations</button></div></div><div><label>Cluster label <input id="research-cluster-label" value="Recurring reader friction"></label><div id="research-observation-list" class="compact-list">${observations.map((item) => `<label><input type="checkbox" data-research-observation value="${escapeHtml(item.id)}"> ${escapeHtml(item.id)} · ${escapeHtml(item.title)} · ${escapeHtml(item.sentiment)}</label>`).join("") || "<p>No observations yet.</p>"}</div><div class="button-row"><button id="preview-review-cluster">Preview cluster</button><button id="apply-review-cluster" class="danger" disabled>Save cluster</button></div></div></div><hr><div class="two-column"><label>Existing cluster <select id="research-friction-cluster">${clusters.map((cluster) => `<option value="${escapeHtml(cluster.id)}">${escapeHtml(cluster.id)} — ${escapeHtml(cluster.label)}</option>`).join("")}</select></label><label>Writer decision <select id="research-friction-decision"><option>prevent</option><option>mitigate</option><option>accept-as-tradeoff</option><option>irrelevant-to-project</option></select></label></div><label>Concise guardrail for prevent/mitigate <input id="research-friction-guardrail"></label><div class="button-row"><button id="preview-friction-decision">Preview decision</button><button id="apply-friction-decision" class="danger" disabled>Save decision</button></div></section>
    <section class="card"><h3>Research Ledger</h3><p>Ready claims must name registered sources, reliability, dates, risks, knowledge scope, and a dramatic use.</p><label>Existing item <select id="research-item-select"><option value="">New item</option>${items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.id)} — ${escapeHtml(item.status)}</option>`).join("")}</select></label><label>Typed item JSON<textarea id="research-item-json" rows="18">${escapeHtml(pretty(items[0] || { id: "", lane: "story-world", claim: "", source_ids: [], confidence: "low", verified_on: null, fictionalization: { status: "unchanged", reason: "" }, knowledge_scope: { known_by: [], incorrectly_believed_by: [], unknown_to: [] }, risk: [], dramatic_uses: [], story_use: { chapters: [], decision_affected: "" }, notes: "", status: "researching" }))}</textarea></label><div class="button-row"><button id="preview-research-item">Check readiness</button><button id="apply-research-item" class="danger" disabled>Save item</button></div></section>
    <section class="card"><h3>Revision Learning</h3><p>Eligibility requires three distinct chapters or two milestone reviews. Only an explicit writer decision activates a future rule.</p><label>Eligible pattern <select id="research-learning-pattern">${candidates.map((candidate) => `<option value="${escapeHtml(candidate.patternId)}">${escapeHtml(candidate.patternId)} · ${candidate.distinctChapters.length} chapters · ${candidate.milestoneReviews.length} reviews</option>`).join("")}</select></label><label>Decision <select id="research-learning-decision"><option>proposed</option><option>approved</option><option>rejected</option></select></label><label>Future drafting rule <textarea id="research-learning-rule" rows="5"></textarea></label><div class="button-row"><button id="preview-learning-decision">Preview evidence</button><button id="apply-learning-decision" class="danger" disabled>Save writer decision</button></div></section>
  </div>`;

  const previews = {};
  const previewRequest = async (action, payload) => api("/api/preview", { method: "POST", body: JSON.stringify({ workflow: "research", action, payload }) });
  const enable = (id, preview) => { previews[id] = preview; document.querySelector(`#${id}`).disabled = false; setResult(preview); };
  document.querySelector("#preview-influence").addEventListener("click", async () => { try { enable("apply-influence", await previewRequest("influence", { reference: fieldValue("research-influence-reference"), influence_type: fieldValue("research-influence-type"), admired_for: researchLines("research-admired"), not_for: researchLines("research-excluded"), derived_traits: researchLines("research-traits") })); } catch (error) { setResult(error.message, true); } });
  document.querySelector("#apply-influence").addEventListener("click", async () => { try { await applyAction("save-influence", { preview_id: previews["apply-influence"].preview_id }); } catch (error) { setResult(error.message, true); } });
  document.querySelector("#preview-voice").addEventListener("click", async () => { try { const preview = await previewRequest("voice-comparison", { experiment_id: fieldValue("research-experiment") }); previews.voice = preview; document.querySelector("#research-variants").innerHTML = preview.variants.map((variant) => `<article class="card variant-card"><h4>Variant ${escapeHtml(variant.id)}</h4><pre>${escapeHtml(variant.prose)}</pre><label>Feels like book <input id="score-${variant.id}-feel" type="number" min="1" max="5" value="3"></label><label>Continue <input id="score-${variant.id}-continue" type="number" min="1" max="5" value="3"></label><label>Intimacy <input id="score-${variant.id}-intimacy" type="number" min="1" max="5" value="3"></label><label>Naturalness <input id="score-${variant.id}-natural" type="number" min="1" max="5" value="3"></label><label>Distinctiveness <input id="score-${variant.id}-distinct" type="number" min="1" max="5" value="3"></label><label>Density (-2 to 2) <input id="score-${variant.id}-density" type="number" min="-2" max="2" value="0"></label><label>Note <input id="score-${variant.id}-note"></label></article>`).join(""); document.querySelector("#save-voice-scores").disabled = false; document.querySelector("#accept-voice-baseline").disabled = false; setResult(preview.summary); } catch (error) { setResult(error.message, true); } });
  const voicePayload = () => ({ preview_id: previews.voice.preview_id, scores: previews.voice.variants.map((variant) => ({ evaluator_id: "writer", variant_id: variant.id, feels_like_book: researchScore(`score-${variant.id}-feel`), desire_to_continue: researchScore(`score-${variant.id}-continue`), character_intimacy: researchScore(`score-${variant.id}-intimacy`), prose_naturalness: researchScore(`score-${variant.id}-natural`), distinctiveness: researchScore(`score-${variant.id}-distinct`), density: researchScore(`score-${variant.id}-density`, 0), note: fieldValue(`score-${variant.id}-note`) })), accepted_traits: researchLines("research-accepted-traits") });
  document.querySelector("#save-voice-scores").addEventListener("click", async () => { try { await applyAction("save-voice-scores", voicePayload()); } catch (error) { setResult(error.message, true); } });
  document.querySelector("#accept-voice-baseline").addEventListener("click", async () => { try { await applyAction("accept-voice-baseline", { ...voicePayload(), selection: fieldValue("research-baseline-choice"), custom_baseline: fieldValue("research-custom-baseline") }); } catch (error) { setResult(error.message, true); } });
  document.querySelector("#preview-review-csv").addEventListener("click", async () => { try { let payload = { csv_text: fieldValue("research-review-csv") }; const file = document.querySelector("#research-review-file").files[0]; if (file) { const source = await upload(file); payload = { source_id: source.source_id }; } enable("apply-review-csv", await previewRequest("review-csv", payload)); } catch (error) { setResult(error.message, true); } });
  document.querySelector("#apply-review-csv").addEventListener("click", async () => { try { await applyAction("import-review-observations", { preview_id: previews["apply-review-csv"].preview_id }); } catch (error) { setResult(error.message, true); } });
  document.querySelector("#preview-review-cluster").addEventListener("click", async () => { try { enable("apply-review-cluster", await previewRequest("review-cluster", { label: fieldValue("research-cluster-label"), observation_ids: selectedValues("[data-research-observation]") })); } catch (error) { setResult(error.message, true); } });
  document.querySelector("#apply-review-cluster").addEventListener("click", async () => { try { await applyAction("save-review-cluster", { preview_id: previews["apply-review-cluster"].preview_id }); } catch (error) { setResult(error.message, true); } });
  document.querySelector("#preview-friction-decision").addEventListener("click", async () => { try { enable("apply-friction-decision", await previewRequest("friction-decision", { cluster_id: fieldValue("research-friction-cluster"), decision: fieldValue("research-friction-decision"), guardrail: fieldValue("research-friction-guardrail") })); } catch (error) { setResult(error.message, true); } });
  document.querySelector("#apply-friction-decision").addEventListener("click", async () => { try { await applyAction("save-friction-decision", { preview_id: previews["apply-friction-decision"].preview_id }); } catch (error) { setResult(error.message, true); } });
  document.querySelector("#research-item-select").addEventListener("change", () => { const item = items.find((value) => value.id === fieldValue("research-item-select")); if (item) document.querySelector("#research-item-json").value = pretty(item); });
  document.querySelector("#preview-research-item").addEventListener("click", async () => { try { enable("apply-research-item", await previewRequest("research-item", { item: JSON.parse(fieldValue("research-item-json")) })); } catch (error) { setResult(error.message, true); } });
  document.querySelector("#apply-research-item").addEventListener("click", async () => { try { await applyAction("save-research-item", { preview_id: previews["apply-research-item"].preview_id }); } catch (error) { setResult(error.message, true); } });
  document.querySelector("#preview-learning-decision").addEventListener("click", async () => { try { enable("apply-learning-decision", await previewRequest("learning-decision", { pattern_id: fieldValue("research-learning-pattern"), decision: fieldValue("research-learning-decision"), rule: fieldValue("research-learning-rule") })); } catch (error) { setResult(error.message, true); } });
  document.querySelector("#apply-learning-decision").addEventListener("click", async () => { try { await applyAction("save-learning-decision", { preview_id: previews["apply-learning-decision"].preview_id }); } catch (error) { setResult(error.message, true); } });
}

function renderWorkflow() {
  if (activeWorkflow === "adoption") adoptionForm();
  else if (activeWorkflow === "readers") readersForm();
  else if (activeWorkflow === "packaging") packagingForm();
  else if (activeWorkflow === "next-book") nextBookForm();
  else if (activeWorkflow === "research") researchForm();
  else content.innerHTML = `<p>Select a workflow.</p>`;
}

async function loadSnapshot() {
  currentSnapshot = await api("/api/snapshot", { method: "POST", body: JSON.stringify({ workflow: activeWorkflow }) });
  snapshot.textContent = pretty(currentSnapshot);
  renderWorkflow();
}

async function selectWorkflow(workflow) {
  activeWorkflow = workflow;
  currentPreview = null;
  document.querySelectorAll("[data-workflow]").forEach((button) => button.classList.toggle("active", button.dataset.workflow === workflow));
  const names = { adoption: "Existing-project adoption", readers: "Reader evidence", packaging: "Packaging checklist", "next-book": "Next-book inheritance", research: "Voice and research evidence" };
  label.textContent = "Guided review";
  title.textContent = names[workflow] || "Workflow";
  content.innerHTML = `<p>Loading workflow…</p>`;
  try { await loadSnapshot(); }
  catch (error) { snapshot.textContent = error.message; content.innerHTML = `<div class="empty-state"><p>${escapeHtml(error.message)}</p></div>`; }
}

for (const button of document.querySelectorAll("[data-workflow]")) button.addEventListener("click", () => selectWorkflow(button.dataset.workflow));

document.querySelector("#preview-proposal").addEventListener("click", async () => {
  try { setResult(await api("/api/preview", { method: "POST", body: JSON.stringify({ workflow: activeWorkflow, action: fieldValue("proposal-action").trim(), payload: JSON.parse(fieldValue("proposal-payload") || "{}") }) })); }
  catch (error) { setResult(error.message, true); }
});

document.querySelector("#apply-proposal").addEventListener("click", async () => {
  try { await applyAction(fieldValue("proposal-action").trim(), JSON.parse(fieldValue("proposal-payload") || "{}")); }
  catch (error) { setResult(error.message, true); }
});

document.querySelector("#close-session").addEventListener("click", async () => {
  try { await api("/api/close", { method: "POST", body: "{}" }); } catch {}
  document.body.innerHTML = '<main class="closed"><h1>Wizard closed</h1><p>You may close this tab.</p></main>';
});

(async () => {
  if (!token) { summary.textContent = "This wizard URL has no session credential. Launch it again from /novel."; return; }
  try {
    const session = await api("/api/session", { method: "POST", body: "{}" });
    summary.textContent = `Connected to a loopback-only session. Idle timeout: ${Math.round(session.idle_timeout_ms / 60000)} minutes.`;
    if (activeWorkflow) await selectWorkflow(activeWorkflow);
  } catch (error) { summary.textContent = error.message; }
})();
