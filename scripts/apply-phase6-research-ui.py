from pathlib import Path

root = Path('.')

# Fix canonical voice-experiment validation call.
path = root / 'src/application/research/wizard.ts'
text = path.read_text(encoding='utf-8')
old = '''      const { experiment } = experimentFile(root, experimentId);
      const blockers = voiceExperimentFindings({ root, taste: state.tasteValue, index: state.indexValue }).filter((item) => item.severity === "blocker" && item.message.includes(experimentId));
      if (blockers.length) throw new Error(blockers.map((item) => item.message).join("\\n"));
      const variants = variantProse(root, experiment);
'''
new = '''      const { experiment } = experimentFile(root, experimentId);
      const variants = variantProse(root, experiment);
      const assets: Record<string, string> = {};
      const sourceScene = readText(join(root, experiment.source_scene_path));
      if (!sourceScene) throw new Error(`${experimentId} is missing its source scene.`);
      assets[experiment.source_scene_path] = sourceScene;
      for (const variant of experiment.variants) {
        const prose = readText(join(root, variant.path));
        if (prose) assets[variant.path] = prose;
      }
      if (experiment.baseline_path) {
        const baseline = readText(join(root, experiment.baseline_path));
        if (baseline) assets[experiment.baseline_path] = baseline;
      }
      const findings = voiceExperimentFindings(experiment, assets, state.tasteValue);
      if (findings.length) throw new Error(findings.map((item) => item.message).join("\\n"));
'''
if old not in text:
    raise RuntimeError('voice comparison validation anchor missing')
path.write_text(text.replace(old, new, 1), encoding='utf-8')

# Add the research workflow tab and update visible version.
path = root / 'wizard/index.html'
text = path.read_text(encoding='utf-8')
text = text.replace('Novel Forge 1.2', 'Novel Forge 1.3')
anchor = '      <button data-workflow="next-book">Next book</button>\n'
if 'data-workflow="research"' not in text:
    if anchor not in text:
        raise RuntimeError('wizard tab anchor missing')
    text = text.replace(anchor, anchor + '      <button data-workflow="research">Voice & research</button>\n', 1)
path.write_text(text, encoding='utf-8')

# Add research styles and five-column workflow tabs.
path = root / 'wizard/styles.css'
text = path.read_text(encoding='utf-8')
text = text.replace('grid-template-columns: repeat(4, minmax(0,1fr));', 'grid-template-columns: repeat(5, minmax(0,1fr));')
addition = '''
.research-grid { display: grid; gap: 16px; grid-template-columns: repeat(2, minmax(0,1fr)); }
.research-grid .wide { grid-column: 1 / -1; }
.variant-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; }
.variant-card pre { max-height: 28vh; font-size: .82rem; }
.evidence-note { border-left: 4px solid #315c67; padding: 10px 12px; background: #f1f7f8; border-radius: 8px; color: #30434a; }
.compact-list { display: grid; gap: 8px; max-height: 34vh; overflow: auto; }
.compact-list label { margin: 0; padding: 8px; border: 1px solid #dde3e7; border-radius: 8px; background: white; }
@media (max-width: 1100px) { .research-grid, .variant-grid { grid-template-columns: 1fr; } .research-grid .wide { grid-column: auto; } }
'''
if '.research-grid {' not in text:
    text += addition
path.write_text(text, encoding='utf-8')

# Add a complete research browser surface while retaining existing workflows.
path = root / 'wizard/app.js'
text = path.read_text(encoding='utf-8')
research_js = r'''
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

'''
anchor = 'function renderWorkflow() {\n'
if 'function researchForm()' not in text:
    if anchor not in text:
        raise RuntimeError('renderWorkflow anchor missing')
    text = text.replace(anchor, research_js + anchor, 1)
text = text.replace('  else if (activeWorkflow === "next-book") nextBookForm();\n', '  else if (activeWorkflow === "next-book") nextBookForm();\n  else if (activeWorkflow === "research") researchForm();\n')
text = text.replace('const names = { adoption: "Existing-project adoption", readers: "Reader evidence", packaging: "Packaging checklist", "next-book": "Next-book inheritance" };', 'const names = { adoption: "Existing-project adoption", readers: "Reader evidence", packaging: "Packaging checklist", "next-book": "Next-book inheritance", research: "Voice and research evidence" };')
text = text.replace('    const session = await api("/api/session");', '    const session = await api("/api/session", { method: "POST", body: "{}" });')
path.write_text(text, encoding='utf-8')

# Add optional research action to the guided /novel screen.
path = root / 'src/application/guide.ts'
text = path.read_text(encoding='utf-8')
text = text.replace('| "status" | "readers" | "adopt" | "add-book" | "advanced";', '| "status" | "readers" | "research" | "adopt" | "add-book" | "advanced";')
anchor = '  if (readerStage(project.current_stage)) actions.push(action("readers", "Reader evidence", "Prepare isolated reader kits or preview and merge human-response CSVs."));\n'
addition = '  if (project.current_stage !== "complete") actions.push(action("research", "Review voice and research evidence", "Open the local preview-and-apply workspace for influences, anonymous voice calibration, public-market friction, research readiness, and approved learning rules."));\n'
if addition not in text:
    if anchor not in text:
        raise RuntimeError('guide action anchor missing')
    text = text.replace(anchor, anchor + addition, 1)
path.write_text(text, encoding='utf-8')

# Add command routing and guided action to Pi extension.
path = root / 'src/pi/extension.ts'
text = path.read_text(encoding='utf-8')
text = text.replace('  else if (id === "readers") await guidedReaders(root, context);\n', '  else if (id === "readers") await guidedReaders(root, context);\n  else if (id === "research") await openWizard(root, context, "research");\n')
old = 'pi.registerCommand("novel-wizard", { description: "Open the temporary local browser wizard for adoption, readers, packaging, or next-book work", getArgumentCompletions: (prefix) => { const filtered = ["adoption", "readers", "packaging", "next-book"].filter((item) => item.startsWith(prefix)).map((value) => ({ value, label: value })); return filtered.length ? filtered : null; }, handler: async (args, context) => { try { const root = requireProjectRoot(context.cwd); const requested = tokens(args)[0] as WizardWorkflow | undefined; if (requested && !["adoption", "readers", "packaging", "next-book"].includes(requested)) throw new Error("Wizard workflow must be adoption, readers, packaging, or next-book."); await openWizard(root, context, requested); } catch (error) { context.ui.notify(errorText(error), "warning"); } } });'
new = 'pi.registerCommand("novel-wizard", { description: "Open the temporary local browser wizard for adoption, readers, packaging, next-book, or research work", getArgumentCompletions: (prefix) => { const filtered = ["adoption", "readers", "packaging", "next-book", "research"].filter((item) => item.startsWith(prefix)).map((value) => ({ value, label: value })); return filtered.length ? filtered : null; }, handler: async (args, context) => { try { const root = requireProjectRoot(context.cwd); const requested = tokens(args)[0] as WizardWorkflow | undefined; if (requested && !["adoption", "readers", "packaging", "next-book", "research"].includes(requested)) throw new Error("Wizard workflow must be adoption, readers, packaging, next-book, or research."); await openWizard(root, context, requested); } catch (error) { context.ui.notify(errorText(error), "warning"); } } });'
if old not in text:
    raise RuntimeError('novel-wizard command anchor missing')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
