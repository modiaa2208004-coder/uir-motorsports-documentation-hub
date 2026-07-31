"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Project = {
  id: string;
  name: string;
  code: string;
  season: string;
  competition: string;
  vehicleClass: string;
  objective: string;
  vehicleSummary: string;
  status: string;
};

type EvidenceItem = {
  id: string;
  recordId: string;
  filename: string;
  contentType: string;
  size: number;
  caption: string;
};

type RecordItem = {
  id: string;
  projectId: string;
  title: string;
  type: string;
  system: string;
  owner: string;
  reviewer: string;
  status: "Draft" | "In review" | "Approved" | "Returned";
  problem: string;
  details: Record<string, string>;
  completeness: number;
  updatedAt?: string;
};

type Draft = {
  title: string;
  type: string;
  system: string;
  reviewer: string;
  problem: string;
  details: Record<string, string>;
};

type Field = {
  key: string;
  label: string;
  prompt: string;
  placeholder: string;
};

const fallbackProject: Project = {
  id: "HOPE-2027",
  name: "HOPE",
  code: "UIR-FS-2027",
  season: "2026–2027",
  competition: "Formula Student UK 2027",
  vehicleClass: "FS Class · Internal Combustion",
  objective:
    "Design, manufacture and validate a simple, low-cost and reliable Formula Student car capable of a realistic top-20 overall result.",
  vehicleSummary:
    "UIR Motorsports’ first running Formula Student car, developed from the 2026 Concept Class programme.",
  status: "Active",
};

const templateFields: Record<string, Field[]> = {
  "Design Decision": [
    { key: "requirement", label: "Requirement and target", prompt: "What measurable requirement, score target or rule drives this decision?", placeholder: "Example: reduce unsprung mass while maintaining a factor of safety above…" },
    { key: "alternatives", label: "Alternatives considered", prompt: "Which realistic concepts or components did you compare?", placeholder: "List each option and why it was considered…" },
    { key: "criteria", label: "Comparison criteria", prompt: "How were the alternatives judged and weighted?", placeholder: "Performance, mass, cost, manufacturability, reliability…" },
    { key: "analysis", label: "Calculations and analysis", prompt: "What calculations, simulations, references or measurements support the comparison?", placeholder: "State assumptions, inputs, outputs and source links…" },
    { key: "decision", label: "Selected solution", prompt: "What was selected, and why is it the strongest fit for the project?", placeholder: "Explain the evidence-based decision…" },
    { key: "disadvantages", label: "Disadvantages and compromises", prompt: "What does the selected option make worse or more difficult?", placeholder: "Be specific about the trade-offs accepted…" },
    { key: "validation", label: "Verification plan", prompt: "How will the team prove that this decision works?", placeholder: "Simulation correlation, rig test, inspection, track test…" },
  ],
  "Calculation / Simulation": [
    { key: "objective", label: "Analysis objective", prompt: "What engineering question must this analysis answer?", placeholder: "Define the decision or target this model supports…" },
    { key: "method", label: "Model and method", prompt: "Which equations, software and modelling approach were used?", placeholder: "Include references, model type and version…" },
    { key: "inputs", label: "Inputs and assumptions", prompt: "Which values, units, boundary conditions and assumptions were used?", placeholder: "List every important input and its source…" },
    { key: "results", label: "Results", prompt: "What did the model produce?", placeholder: "Report key numbers, graphs and parameter sweeps…" },
    { key: "sensitivity", label: "Sensitivity and uncertainty", prompt: "How do uncertain inputs affect the result?", placeholder: "Describe the range tested and its effect…" },
    { key: "validation", label: "Validation", prompt: "How was the model checked against theory, another model or physical data?", placeholder: "State the comparison and acceptable error…" },
    { key: "conclusion", label: "Engineering conclusion", prompt: "What decision follows from the results?", placeholder: "Explain what the team should do next…" },
  ],
  "Physical Test": [
    { key: "objective", label: "Test objective", prompt: "What requirement or assumption is this test verifying?", placeholder: "Define the pass/fail target…" },
    { key: "equipment", label: "Equipment and setup", prompt: "What equipment, sensors, samples and setup were used?", placeholder: "Include calibration or accuracy where relevant…" },
    { key: "method", label: "Method", prompt: "What exact sequence was followed?", placeholder: "Write a repeatable test procedure…" },
    { key: "conditions", label: "Test conditions", prompt: "What loads, temperatures, speeds or boundary conditions applied?", placeholder: "State units and tolerances…" },
    { key: "results", label: "Results", prompt: "What was measured or observed?", placeholder: "Report the result without hiding failed cases…" },
    { key: "uncertainty", label: "Uncertainty and limitations", prompt: "What may affect confidence in the result?", placeholder: "Measurement error, sample size, setup limitations…" },
    { key: "conclusion", label: "Conclusion and action", prompt: "Did the test pass, and what happens next?", placeholder: "State pass/fail and the required action…" },
  ],
  "Risk / FMEA": [
    { key: "function", label: "Function or activity", prompt: "Which component, process or activity is being assessed?", placeholder: "Example: braking hydraulic circuit…" },
    { key: "failure_mode", label: "Failure mode", prompt: "How could it fail?", placeholder: "Describe the credible failure…" },
    { key: "effect", label: "Effect", prompt: "What happens if the failure occurs?", placeholder: "Effect on safety, performance or schedule…" },
    { key: "cause", label: "Cause", prompt: "What could create this failure?", placeholder: "Design, manufacturing, human or environmental causes…" },
    { key: "ratings", label: "Risk ratings", prompt: "What are the severity, occurrence and detection ratings?", placeholder: "S = …, O = …, D = …, RPN = …" },
    { key: "controls", label: "Controls and owner", prompt: "What prevents or detects the failure, and who owns the action?", placeholder: "Design control, inspection, test, training…" },
    { key: "verification", label: "Control verification", prompt: "What evidence proves the control is implemented?", placeholder: "Link a test, drawing, checklist or inspection…" },
  ],
  "Manufacturing Record": [
    { key: "part", label: "Part or assembly", prompt: "What is being manufactured and which released design does it use?", placeholder: "Part number, drawing revision and assembly…" },
    { key: "material", label: "Material and source", prompt: "Which material, specification and supplier are used?", placeholder: "Grade, dimensions, certificate or datasheet…" },
    { key: "process", label: "Manufacturing process", prompt: "Which operations, machines, tooling and parameters are required?", placeholder: "Write the production sequence…" },
    { key: "quality", label: "Quality controls", prompt: "Which dimensions, welds or features must be inspected?", placeholder: "Acceptance limits and inspection method…" },
    { key: "time_cost", label: "Time, cost and carbon evidence", prompt: "What resources and supporting evidence are available?", placeholder: "Hours, quotations, invoices, process energy…" },
    { key: "issues", label: "Issues and lessons", prompt: "What went wrong or could be improved?", placeholder: "Rework, scrap, access or tooling problems…" },
    { key: "approval", label: "Release acceptance", prompt: "Who inspected it and what evidence confirms acceptance?", placeholder: "Inspection result and responsible reviewer…" },
  ],
  "Weekly Progress": [
    { key: "completed", label: "Work completed", prompt: "What was completed since the last update?", placeholder: "Use concrete deliverables, not general activity…" },
    { key: "evidence_summary", label: "Evidence created", prompt: "What files, decisions, calculations or tests were produced?", placeholder: "List record IDs or evidence names…" },
    { key: "blockers", label: "Blockers and risks", prompt: "What is stopping progress or threatening the deadline?", placeholder: "State the impact and escalation needed…" },
    { key: "decisions", label: "Decisions required", prompt: "Which decisions need an owner and due date?", placeholder: "Decision, owner and latest acceptable date…" },
    { key: "next_actions", label: "Next actions", prompt: "What will be completed next week?", placeholder: "Action, owner, due date and acceptance test…" },
    { key: "support", label: "Support needed", prompt: "What help is required from another department or leader?", placeholder: "Interface, purchase, access, review or resource…" },
  ],
};

const templates = [
  ["◇", "Design Decision", "Alternatives, trade-offs, calculations and validation"],
  ["∑", "Calculation / Simulation", "Inputs, model, results, sensitivity and validation"],
  ["◫", "Physical Test", "Method, equipment, results, uncertainty and conclusion"],
  ["△", "Risk / FMEA", "Failure modes, ratings, controls and verification"],
  ["⌁", "Manufacturing Record", "Process, quality, time, cost and carbon evidence"],
  ["▥", "Weekly Progress", "Completed work, blockers, evidence and next actions"],
];

const nav = [
  ["▦", "Dashboard"],
  ["◆", "Project"],
  ["▤", "Records"],
  ["✓", "Review"],
  ["□", "Evidence"],
  ["▧", "Templates"],
  ["▥", "Reports"],
];

const systems = [
  "Whole Vehicle",
  "Vehicle Mechanics",
  "Chassis",
  "Powertrain",
  "Electronics",
  "Business",
  "Operations",
];

const emptyDraft = (type = "Design Decision"): Draft => ({
  title: "",
  type,
  system: "Vehicle Mechanics",
  reviewer: "Department Leader",
  problem: "",
  details: Object.fromEntries((templateFields[type] ?? []).map((field) => [field.key, ""])),
});

export default function Hub() {
  const [view, setView] = useState("Dashboard");
  const [project, setProject] = useState<Project>(fallbackProject);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [evidenceCaption, setEvidenceCaption] = useState("");
  const [selected, setSelected] = useState<RecordItem | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [reportSelection, setReportSelection] = useState<Set<string>>(new Set());

  useEffect(() => {
    void loadWorkspace();
  }, []);

  async function loadWorkspace() {
    setLoading(true);
    try {
      const [projectResponse, recordResponse] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/records"),
      ]);
      if (!projectResponse.ok || !recordResponse.ok) throw new Error("Workspace did not load");
      const projectPayload = (await projectResponse.json()) as { projects: Project[] };
      const recordPayload = (await recordResponse.json()) as { records: Array<Record<string, unknown>> };
      const activeProject = projectPayload.projects[0] ?? fallbackProject;
      const mapped = recordPayload.records.map(mapRecord).filter((item) => item.projectId === activeProject.id);
      setProject(activeProject);
      setRecords(mapped);
      setReportSelection(new Set(mapped.map((item) => item.id)));
    } catch {
      setError("The online workspace could not be reached. Please refresh before entering new work.");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(
    () =>
      records.filter((item) =>
        `${item.title} ${item.type} ${item.system} ${item.problem}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [records, search],
  );
  const reviewRecords = records.filter(
    (item) => item.status === "In review" || item.status === "Returned",
  );
  const evidenceReady = records.length
    ? Math.round(records.reduce((sum, item) => sum + item.completeness, 0) / records.length)
    : 0;

  function openWizard(type = "Design Decision") {
    setDraft(emptyDraft(type));
    setPendingFiles([]);
    setEvidenceCaption("");
    setWizardStep(1);
    setWizardOpen(true);
  }

  function changeTemplate(type: string) {
    setDraft((current) => ({
      ...emptyDraft(type),
      title: current.title,
      system: current.system,
      reviewer: current.reviewer,
      problem: current.problem,
    }));
  }

  async function createRecord() {
    setError("");
    try {
      const response = await fetch("/api/records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          ...draft,
          owner: "Mohammed Ismail",
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      const payload = (await response.json()) as { record: Record<string, unknown> };
      const created = mapRecord(payload.record);

      for (const file of pendingFiles) {
        const body = new FormData();
        body.set("recordId", created.id);
        body.set("caption", evidenceCaption);
        body.set("file", file);
        const upload = await fetch("/api/evidence", { method: "POST", body });
        if (!upload.ok) throw new Error("The record saved, but one evidence file did not upload.");
      }

      setRecords((current) => [created, ...current]);
      setReportSelection((current) => new Set(current).add(created.id));
      setWizardOpen(false);
      setView("Records");
      setSelected(created);
      showNotice(`${created.id} saved. Continue editing or export it when ready.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The record could not be saved.");
    }
  }

  async function saveProject(updated: Project) {
    const response = await fetch(`/api/projects/${updated.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(updated),
    });
    if (!response.ok) throw new Error("Project details could not be saved.");
    const payload = (await response.json()) as { project: Project };
    setProject(payload.project);
    showNotice("Project goals and vehicle details were saved.");
  }

  async function saveRecord(updated: RecordItem) {
    const response = await fetch(`/api/records/${updated.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(updated),
    });
    if (!response.ok) throw new Error("The record could not be updated.");
    const payload = (await response.json()) as { record: Record<string, unknown> };
    const saved = mapRecord(payload.record);
    setRecords((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    setSelected(saved);
    showNotice(`${saved.id} updated.`);
  }

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3600);
  }

  function toggleReportRecord(id: string) {
    setReportSelection((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const reportRecords = records.filter((item) => reportSelection.has(item.id));

  return (
    <main className="hub">
      <header className="topbar">
        <button className="brand" onClick={() => setView("Dashboard")} aria-label="Dashboard">
          <b>UIR</b><i /><span><strong>UIR Motorsports</strong><small>Documentation Hub</small></span>
        </button>
        <label className="search">
          <span>⌕</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records, systems, evidence…" />
          <kbd>⌘ K</kbd>
        </label>
        <button className="project-chip" onClick={() => setView("Project")}>
          <small>ACTIVE PROJECT</small><strong>{project.name} · {project.season}</strong><span>⌄</span>
        </button>
        <div className="top-actions"><button className="profile"><span>MI</span><span><strong>Mohammed Ismail</strong><small>Team Leader</small></span></button></div>
      </header>

      <aside className="sidebar">
        <nav>
          {nav.map(([icon, label]) => (
            <button key={label} className={view === label ? "active" : ""} onClick={() => setView(label)}>
              <span>{icon}</span><em>{label}</em>
              {label === "Review" && reviewRecords.length > 0 && <b>{reviewRecords.length}</b>}
            </button>
          ))}
        </nav>
        <div className="gate"><small>Current programme</small><strong>{project.code}</strong><time>{project.status}</time><div><i /></div><span>{project.competition}</span></div>
        <button className="settings" onClick={() => setView("Project")}><span>⚙</span><em>Project settings</em></button>
      </aside>

      <section className="workspace">
        <div className="blueprint" />
        {notice && <div className="toast">✓ &nbsp; {notice}</div>}
        {error && <div className="error-banner"><span>!</span><p>{error}</p><button onClick={() => setError("")}>×</button></div>}

        {view === "Dashboard" && (
          <>
            <PageHeader
              project={project}
              title={<>Build the evidence.<br /><span>Then build the document.</span></>}
              intro="Every calculation, decision, test and risk belongs inside the active vehicle project."
              action={<button className="primary" onClick={() => openWizard()}>＋ Add engineering record</button>}
            />
            <section className="workflow-strip">
              {[
                ["01", "Project", "Define the car and season goals"],
                ["02", "Record", "Answer guided engineering questions"],
                ["03", "Evidence", "Attach files, images and results"],
                ["04", "Export", "Build Word and PDF documents"],
              ].map(([number, title, copy], index) => (
                <button key={title} onClick={() => setView(index === 0 ? "Project" : index === 3 ? "Reports" : index === 2 ? "Evidence" : "Records")}>
                  <b>{number}</b><span><strong>{title}</strong><small>{copy}</small></span><i>→</i>
                </button>
              ))}
            </section>
            <section className="metrics">
              <Metric icon="▤" value={String(records.length)} label="Project records" note={records.length ? "Live project data" : "Start here"} tone={records.length ? "green" : "amber"} />
              <Metric icon="✓" value={String(reviewRecords.length)} label="Awaiting action" note="Review queue" />
              <Metric icon="□" value={`${evidenceReady}%`} label="Details complete" note="Across records" tone={evidenceReady > 70 ? "green" : "amber"} />
              <Metric icon="▥" value={String(records.filter((item) => item.status === "Approved").length)} label="Export-ready" note="Approved records" tone="green" />
            </section>
            {loading ? <LoadingState /> : records.length ? (
              <section className="dashboard-grid dashboard-grid-new">
                <Panel label="Active project" title={`${project.name} engineering records`} action={<button onClick={() => setView("Records")}>View all →</button>}>
                  <RecordTable records={filtered.slice(0, 4)} onOpen={setSelected} />
                </Panel>
                <Panel label="Leader action required" title="Review queue" action={<span className="pill">{reviewRecords.length} open</span>}>
                  {reviewRecords.length ? <div className="review-cards">{reviewRecords.slice(0, 4).map((item) => <button key={item.id} onClick={() => setSelected(item)}><span><strong>{item.title}</strong><small>{item.id} · {item.system}</small></span><Status value={item.status} /></button>)}</div> : <MiniEmpty title="Nothing waiting" copy="Move a completed draft to “In review” when it is ready." />}
                </Panel>
                <Panel label="Programme definition" title="Why this project exists">
                  <div className="objective-card"><p>{project.objective || "Add the programme objective in Project."}</p><button onClick={() => setView("Project")}>Edit project goals →</button></div>
                </Panel>
              </section>
            ) : (
              <section className="onboarding-empty">
                <span>01</span><div><small>YOUR PROJECT IS READY</small><h2>Now add the first real engineering record.</h2><p>Choose a template, answer the guided questions, attach the evidence, and save it inside {project.name}. You can reopen it at any time.</p></div><button className="primary" onClick={() => openWizard()}>Create first record →</button>
              </section>
            )}
          </>
        )}

        {view === "Project" && (
          <Module title={`${project.name} project`} intro="The project is the container. All engineering records, evidence and generated reports live inside it.">
            <ProjectEditor project={project} recordCount={records.length} onSave={saveProject} onNewRecord={openWizard} />
          </Module>
        )}

        {view === "Records" && (
          <Module title="Engineering records" intro={`Detailed engineering work stored inside ${project.name} — click any row to open, edit and export it.`} action={<button className="primary" onClick={() => openWizard()}>＋ New record</button>}>
            <section className="wide-panel">
              <header className="filters"><strong>{filtered.length} records</strong><span>{project.code}</span><button onClick={() => exportCsv(records, project)}>Download register (.csv)</button></header>
              {filtered.length ? <RecordTable records={filtered} onOpen={setSelected} /> : <MiniEmpty title="No records yet" copy="A project becomes useful only after you add decisions, calculations, tests, risks and manufacturing evidence." action={<button className="primary small-primary" onClick={() => openWizard()}>Add the first record</button>} />}
            </section>
          </Module>
        )}

        {view === "Review" && (
          <Module title="Review control" intro="Open a record, check the engineering details and evidence, then change its status.">
            <section className="review-stats">
              <article><small>AWAITING TECHNICAL REVIEW</small><strong>{records.filter((item) => item.status === "In review").length}</strong><span>Submitted by members</span></article>
              <article><small>APPROVED</small><strong>{records.filter((item) => item.status === "Approved").length}</strong><span>Available for official reports</span></article>
              <article><small>RETURNED FOR REVISION</small><strong>{records.filter((item) => item.status === "Returned").length}</strong><span>Missing or unclear information</span></article>
            </section>
            <section className="wide-panel actions">
              <header className="filters"><strong>Technical review queue</strong><span>Open a record to review</span></header>
              {reviewRecords.length ? reviewRecords.map((item) => <div className="action-row" key={item.id}><span>▤</span><div><strong>{item.title}</strong><small>{item.id} · {item.system} · Reviewer: {item.reviewer}</small></div><div className="completion"><small>{item.completeness}% complete</small><i><b style={{ width: `${item.completeness}%` }} /></i></div><button onClick={() => setSelected(item)}>Open review</button></div>) : <MiniEmpty title="The queue is clear" copy="Records with “In review” or “Returned” status appear here." />}
            </section>
          </Module>
        )}

        {view === "Evidence" && (
          <Module title="Evidence library" intro="Evidence is added to a specific record, so every file keeps its engineering context.">
            <section className="evidence-help"><span>□</span><div><small>HOW TO ADD A DOCUMENT OR IMAGE</small><h2>Open the engineering record first.</h2><p>Select a record below, open its <b>Evidence</b> tab, choose the file, write a caption explaining what it proves, and upload it. The file then stays attached to that record and appears in exports.</p></div></section>
            <section className="evidence-grid">{records.map((item) => <button key={item.id} onClick={() => setSelected(item)}><span>▤</span><div><strong>{item.title}</strong><small>{item.id} · {item.type}</small><p>{item.problem || "No problem statement yet."}</p></div><i>Add or view evidence →</i></button>)}{!records.length && <MiniEmpty title="No record can receive evidence yet" copy="Create an engineering record first, then attach evidence inside it." action={<button className="primary small-primary" onClick={() => openWizard()}>Create a record</button>} />}</section>
          </Module>
        )}

        {view === "Templates" && (
          <Module title="Guided templates" intro="Select the kind of work. The platform asks the correct questions instead of giving members a blank page.">
            <section className="template-grid">{templates.map(([icon, name, description]) => <article key={name}><span>{icon}</span><small>{templateFields[name].length} GUIDED QUESTIONS</small><h2>{name}</h2><p>{description}</p><button onClick={() => openWizard(name)}>Use template →</button></article>)}</section>
          </Module>
        )}

        {view === "Reports" && (
          <Module title="Document builder" intro="Choose the records to include, then download an editable Word file or a judge-ready PDF.">
            <section className="report-layout">
              <article className="report-settings">
                <small>STEP 1 · DOCUMENT TYPE</small><h2>Engineering evidence pack</h2><p>Builds a consistent report from the selected records. Draft and review statuses are clearly labelled.</p>
                <label>Document title<input id="report-title" defaultValue={`${project.name} Engineering Evidence Pack`} /></label>
                <div className="report-actions">
                  <button className="primary" disabled={!reportRecords.length} onClick={() => exportWord(project, reportRecords, reportTitle())}>Download Word (.doc)</button>
                  <button className="secondary" disabled={!reportRecords.length} onClick={() => void exportPdf(project, reportRecords, reportTitle())}>Download PDF</button>
                </div>
                <p className="export-note">Exports are generated from the current saved records. Attached evidence is listed by filename and caption.</p>
              </article>
              <article className="report-records">
                <header><div><small>STEP 2 · CONTENT</small><h2>{reportRecords.length} records selected</h2></div><button onClick={() => setReportSelection(new Set(records.map((item) => item.id)))}>Select all</button></header>
                {records.map((item) => <label key={item.id} className={reportSelection.has(item.id) ? "selected" : ""}><input type="checkbox" checked={reportSelection.has(item.id)} onChange={() => toggleReportRecord(item.id)} /><span><strong>{item.title}</strong><small>{item.id} · {item.type} · {item.status}</small></span><b>{item.completeness}%</b></label>)}
                {!records.length && <MiniEmpty title="Nothing to export" copy="Create and save at least one engineering record first." />}
              </article>
            </section>
          </Module>
        )}
      </section>

      {wizardOpen && (
        <RecordWizard
          step={wizardStep}
          draft={draft}
          files={pendingFiles}
          evidenceCaption={evidenceCaption}
          onDraft={setDraft}
          onFiles={setPendingFiles}
          onCaption={setEvidenceCaption}
          onTemplate={changeTemplate}
          onStep={setWizardStep}
          onClose={() => setWizardOpen(false)}
          onSave={() => void createRecord()}
        />
      )}

      {selected && (
        <RecordDetail
          key={selected.id}
          record={selected}
          project={project}
          onClose={() => setSelected(null)}
          onSave={saveRecord}
          onEvidenceUploaded={() => showNotice("Evidence uploaded and attached to this record.")}
        />
      )}
    </main>
  );
}

function mapRecord(item: Record<string, unknown>): RecordItem {
  let details: Record<string, string> = {};
  try {
    details = JSON.parse(String(item.detailsJson ?? "{}")) as Record<string, string>;
  } catch {
    details = {};
  }
  return {
    id: String(item.id),
    projectId: String(item.projectId ?? "HOPE-2027"),
    title: String(item.title ?? "Untitled record"),
    type: String(item.type ?? "Design Decision"),
    system: String(item.system ?? "Whole Vehicle"),
    owner: String(item.owner ?? "Unknown"),
    reviewer: String(item.reviewer ?? "Department Leader"),
    status: String(item.status ?? "Draft") as RecordItem["status"],
    problem: String(item.problem ?? ""),
    details,
    completeness: Number(item.completeness ?? 0),
    updatedAt: item.updatedAt ? String(item.updatedAt) : undefined,
  };
}

function RecordWizard({
  step,
  draft,
  files,
  evidenceCaption,
  onDraft,
  onFiles,
  onCaption,
  onTemplate,
  onStep,
  onClose,
  onSave,
}: {
  step: number;
  draft: Draft;
  files: File[];
  evidenceCaption: string;
  onDraft: (value: Draft) => void;
  onFiles: (value: File[]) => void;
  onCaption: (value: string) => void;
  onTemplate: (type: string) => void;
  onStep: (step: number) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const fields = templateFields[draft.type] ?? [];
  const canContinue =
    step === 1 ? Boolean(draft.title.trim() && draft.problem.trim()) :
    step === 2 ? fields.some((field) => draft.details[field.key]?.trim()) :
    true;
  return (
    <div className="overlay" onMouseDown={onClose}>
      <section className="modal wizard-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><small>NEW RECORD · {draft.type.toUpperCase()}</small><h2>{step === 1 ? "Choose and define the work" : step === 2 ? "Answer the engineering questions" : step === 3 ? "Attach supporting evidence" : "Review before saving"}</h2></div><button onClick={onClose} aria-label="Close">×</button></header>
        <div className="steps">{["Type", "Details", "Evidence", "Review"].map((label, index) => <span key={label} className={step === index + 1 ? "active" : step > index + 1 ? "done" : ""}>{step > index + 1 ? "✓" : index + 1} <b>{label}</b>{index < 3 && <i />}</span>)}</div>
        <div className="wizard-body">
          {step === 1 && (
            <>
              <label>Record template<select value={draft.type} onChange={(event) => onTemplate(event.target.value)}>{templates.map((item) => <option key={item[1]}>{item[1]}</option>)}</select></label>
              <label>Record title<input value={draft.title} onChange={(event) => onDraft({ ...draft, title: event.target.value })} placeholder="Example: Front suspension geometry trade study" /></label>
              <div className="form-grid"><label>Subsystem<select value={draft.system} onChange={(event) => onDraft({ ...draft, system: event.target.value })}>{systems.map((system) => <option key={system}>{system}</option>)}</select></label><label>Reviewer<select value={draft.reviewer} onChange={(event) => onDraft({ ...draft, reviewer: event.target.value })}><option>Department Leader</option><option>Technical Leader</option><option>Team Leader</option><option>Faculty Advisor</option></select></label></div>
              <label>Problem or purpose<textarea value={draft.problem} onChange={(event) => onDraft({ ...draft, problem: event.target.value })} placeholder="What engineering problem, rule, risk or project need created this work?" /></label>
            </>
          )}
          {step === 2 && <div className="guided-fields">{fields.map((field, index) => <label key={field.key}><span><b>{String(index + 1).padStart(2, "0")}</b><strong>{field.label}</strong></span><small>{field.prompt}</small><textarea value={draft.details[field.key] ?? ""} onChange={(event) => onDraft({ ...draft, details: { ...draft.details, [field.key]: event.target.value } })} placeholder={field.placeholder} /></label>)}</div>}
          {step === 3 && (
            <div className="upload-stage">
              <div className="upload-box"><span>＋</span><h3>Add documents, images or results</h3><p>PDF, Word, Excel, CSV and image files up to 10 MB each.</p><input aria-label="Choose evidence files" type="file" multiple onChange={(event) => onFiles(Array.from(event.target.files ?? []))} /></div>
              <label>Evidence caption<textarea value={evidenceCaption} onChange={(event) => onCaption(event.target.value)} placeholder="Explain what these files show and which claim they support…" /></label>
              {files.length > 0 && <ul className="pending-files">{files.map((file) => <li key={`${file.name}-${file.size}`}><span>□</span><div><strong>{file.name}</strong><small>{formatBytes(file.size)}</small></div></li>)}</ul>}
              <p className="skip-note">Evidence is optional during initial capture. You can add more files after saving by opening the record.</p>
            </div>
          )}
          {step === 4 && (
            <div className="review-summary">
              <div className="summary-hero"><small>RECORD READY TO SAVE</small><h3>{draft.title}</h3><p>{draft.problem}</p></div>
              <dl><div><dt>Template</dt><dd>{draft.type}</dd></div><div><dt>Subsystem</dt><dd>{draft.system}</dd></div><div><dt>Reviewer</dt><dd>{draft.reviewer}</dd></div><div><dt>Answered questions</dt><dd>{Object.values(draft.details).filter((value) => value.trim()).length} / {fields.length}</dd></div><div><dt>Evidence files</dt><dd>{files.length}</dd></div><div><dt>Initial status</dt><dd>Draft</dd></div></dl>
              <div className="ai-note"><b>✓</b><p><strong>Nothing disappears after saving.</strong> The record opens immediately so you can continue the details, upload evidence, send it for review, or export it.</p></div>
            </div>
          )}
        </div>
        <footer className="wizard-footer">
          <button type="button" className="secondary" onClick={step === 1 ? onClose : () => onStep(step - 1)}>{step === 1 ? "Cancel" : "← Back"}</button>
          {step < 4 ? <button className="primary" disabled={!canContinue} onClick={() => onStep(step + 1)}>Continue →</button> : <button className="primary" onClick={onSave}>Save record and open it →</button>}
        </footer>
      </section>
    </div>
  );
}

function RecordDetail({
  record,
  project,
  onClose,
  onSave,
  onEvidenceUploaded,
}: {
  record: RecordItem;
  project: Project;
  onClose: () => void;
  onSave: (record: RecordItem) => Promise<void>;
  onEvidenceUploaded: () => void;
}) {
  const [editing, setEditing] = useState(record);
  const [tab, setTab] = useState<"details" | "evidence" | "export">("details");
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const fields = templateFields[editing.type] ?? [];

  useEffect(() => {
    void fetch(`/api/evidence?recordId=${encodeURIComponent(record.id)}`)
      .then((response) => response.json())
      .then((payload: { evidence?: EvidenceItem[] }) => setEvidence(payload.evidence ?? []))
      .catch(() => setMessage("Evidence could not be loaded."));
  }, [record.id]);

  async function save() {
    setBusy(true); setMessage("");
    try { await onSave(editing); setMessage("Saved."); }
    catch (caught) { setMessage(caught instanceof Error ? caught.message : "Could not save."); }
    finally { setBusy(false); }
  }

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!uploadFile) return;
    setBusy(true); setMessage("");
    try {
      const body = new FormData();
      body.set("recordId", record.id);
      body.set("caption", caption);
      body.set("file", uploadFile);
      const response = await fetch("/api/evidence", { method: "POST", body });
      if (!response.ok) throw new Error((await response.json() as { error?: string }).error || "Upload failed.");
      const payload = (await response.json()) as { evidence: EvidenceItem };
      setEvidence((current) => [...current, payload.evidence]);
      setUploadFile(null); setCaption("");
      onEvidenceUploaded();
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Upload failed."); }
    finally { setBusy(false); }
  }

  return (
    <div className="overlay detail-overlay" onMouseDown={onClose}>
      <section className="record-detail" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header className="detail-header"><div><small>{record.id} · {project.code}</small><input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /><p>{editing.type} · {editing.system}</p></div><button onClick={onClose} aria-label="Close">×</button></header>
        <nav className="detail-tabs"><button className={tab === "details" ? "active" : ""} onClick={() => setTab("details")}>Guided details</button><button className={tab === "evidence" ? "active" : ""} onClick={() => setTab("evidence")}>Evidence <b>{evidence.length}</b></button><button className={tab === "export" ? "active" : ""} onClick={() => setTab("export")}>Export</button></nav>
        <div className="detail-body">
          {message && <div className="inline-message">{message}</div>}
          {tab === "details" && (
            <div className="detail-form">
              <section className="record-meta">
                <label>Status<select value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value as RecordItem["status"] })}><option>Draft</option><option>In review</option><option>Approved</option><option>Returned</option></select></label>
                <label>Subsystem<select value={editing.system} onChange={(event) => setEditing({ ...editing, system: event.target.value })}>{systems.map((system) => <option key={system}>{system}</option>)}</select></label>
                <label>Reviewer<select value={editing.reviewer} onChange={(event) => setEditing({ ...editing, reviewer: event.target.value })}><option>Department Leader</option><option>Technical Leader</option><option>Team Leader</option><option>Faculty Advisor</option></select></label>
              </section>
              <label className="problem-field">Problem or purpose<textarea value={editing.problem} onChange={(event) => setEditing({ ...editing, problem: event.target.value })} /></label>
              <div className="guided-fields compact">{fields.map((field, index) => <label key={field.key}><span><b>{String(index + 1).padStart(2, "0")}</b><strong>{field.label}</strong></span><small>{field.prompt}</small><textarea value={editing.details[field.key] ?? ""} onChange={(event) => setEditing({ ...editing, details: { ...editing.details, [field.key]: event.target.value } })} placeholder={field.placeholder} /></label>)}</div>
            </div>
          )}
          {tab === "evidence" && (
            <div className="evidence-tab">
              <form className="upload-card" onSubmit={upload}>
                <small>ADD EVIDENCE TO {record.id}</small><h3>Upload a supporting file</h3><p>A useful caption explains what the file proves, not only what it is.</p>
                <input type="file" required onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
                <textarea value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Caption: what does this evidence demonstrate?" />
                <button className="primary" disabled={busy || !uploadFile}>Upload and attach</button>
              </form>
              <section className="evidence-list"><header><small>ATTACHED TO THIS RECORD</small><h3>{evidence.length} evidence files</h3></header>{evidence.map((item) => <a key={item.id} href={`/api/evidence/${item.id}`}><span>□</span><div><strong>{item.filename}</strong><small>{formatBytes(item.size)} · {item.contentType}</small><p>{item.caption || "No caption provided."}</p></div><i>Download ↓</i></a>)}{!evidence.length && <MiniEmpty title="No evidence attached" copy="Choose a document, result sheet, drawing or image above." />}</section>
            </div>
          )}
          {tab === "export" && (
            <div className="single-export">
              <span>▥</span><small>GENERATE FROM THIS SAVED RECORD</small><h2>{record.title}</h2><p>The export includes project identity, record metadata, the problem statement, every guided answer, approval status and an evidence register.</p>
              <div><button className="primary" onClick={() => exportWord(project, [editing], editing.title)}>Download Word (.doc)</button><button className="secondary" onClick={() => void exportPdf(project, [editing], editing.title)}>Download PDF</button></div>
            </div>
          )}
        </div>
        <footer className="detail-footer"><span>{editing.completeness}% complete · {editing.status}</span><div><button className="secondary" onClick={onClose}>Close</button>{tab === "details" && <button className="primary" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save changes"}</button>}</div></footer>
      </section>
    </div>
  );
}

function ProjectEditor({ project, recordCount, onSave, onNewRecord }: { project: Project; recordCount: number; onSave: (project: Project) => Promise<void>; onNewRecord: (type?: string) => void }) {
  const [form, setForm] = useState(project);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage("");
    try { await onSave(form); setMessage("Saved."); }
    catch (caught) { setMessage(caught instanceof Error ? caught.message : "Could not save."); }
  }
  return (
    <section className="project-layout">
      <article className="project-summary"><small>ACTIVE VEHICLE PROGRAMME</small><div className="project-mark">{project.name.slice(0, 1)}</div><h2>{project.name}</h2><p>{project.code} · {project.season}</p><dl><div><dt>Records</dt><dd>{recordCount}</dd></div><div><dt>Competition</dt><dd>{project.competition}</dd></div><div><dt>Class</dt><dd>{project.vehicleClass}</dd></div><div><dt>Status</dt><dd>{project.status}</dd></div></dl><button className="primary" onClick={() => onNewRecord()}>＋ Add record inside this project</button></article>
      <form className="project-form" onSubmit={submit}><header><small>PROJECT DETAILS</small><h2>Define what the team is building</h2><p>These values appear in generated documents and give every record the correct context.</p></header>
        {message && <div className="inline-message">{message}</div>}
        <div className="form-grid"><label>Project name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Project code<input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label></div>
        <div className="form-grid"><label>Season<input value={form.season} onChange={(event) => setForm({ ...form, season: event.target.value })} /></label><label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Active</option><option>Planning</option><option>Archived</option></select></label></div>
        <label>Competition<input value={form.competition} onChange={(event) => setForm({ ...form, competition: event.target.value })} /></label>
        <label>Vehicle class and architecture<input value={form.vehicleClass} onChange={(event) => setForm({ ...form, vehicleClass: event.target.value })} /></label>
        <label>Programme objective<textarea value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} /></label>
        <label>Vehicle summary<textarea value={form.vehicleSummary} onChange={(event) => setForm({ ...form, vehicleSummary: event.target.value })} /></label>
        <footer><button className="primary">Save project details</button></footer>
      </form>
    </section>
  );
}

function PageHeader({ project, title, intro, action }: { project: Project; title: React.ReactNode; intro: string; action: React.ReactNode }) {
  return <header className="page-title"><div><small>{project.name} · {project.season} · {project.vehicleClass}</small><h1>{title}</h1><p>{intro}</p></div>{action}</header>;
}
function Module({ title, intro, action, children }: { title: string; intro: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <><header className="module-title"><div><small>UIR MOTORSPORTS · CONTROLLED WORKSPACE</small><h1>{title}</h1><p>{intro}</p></div>{action}</header>{children}</>;
}
function Metric({ icon, value, label, note, tone = "" }: { icon: string; value: string; label: string; note: string; tone?: string }) {
  return <article><span className="metric-icon">{icon}</span><div><strong>{value}</strong><span>{label}</span></div><small className={tone}>{note}</small></article>;
}
function Panel({ label, title, action, children }: { label: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <article className="panel"><header><div><small>{label}</small><h2>{title}</h2></div>{action}</header>{children}</article>;
}
function Status({ value }: { value: string }) {
  return <span className={`status ${value.toLowerCase().replaceAll(" ", "-")}`}>{value}</span>;
}
function RecordTable({ records, onOpen }: { records: RecordItem[]; onOpen: (record: RecordItem) => void }) {
  return <div className="record-table">{records.map((item) => <button className="record-row" key={item.id} onClick={() => onOpen(item)}><span>▤</span><div><strong>{item.title}</strong><small>{item.id} · {item.type}</small></div><span className="system">{item.system}</span><Status value={item.status} /><span className="updated">{item.completeness}%</span><span className="record-open">Open →</span></button>)}</div>;
}
function MiniEmpty({ title, copy, action }: { title: string; copy: string; action?: React.ReactNode }) {
  return <div className="mini-empty"><span>◇</span><h3>{title}</h3><p>{copy}</p>{action}</div>;
}
function LoadingState() {
  return <section className="loading-state"><i /><p>Opening the project workspace…</p></section>;
}
function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function reportTitle() {
  return (document.getElementById("report-title") as HTMLInputElement | null)?.value || "Engineering Evidence Pack";
}
function exportCsv(records: RecordItem[], project: Project) {
  const rows = [
    ["Record ID", "Project", "Title", "Type", "Subsystem", "Owner", "Reviewer", "Status", "Completeness"],
    ...records.map((item) => [item.id, project.code, item.title, item.type, item.system, item.owner, item.reviewer, item.status, `${item.completeness}%`]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${project.code}-record-register.csv`);
}
function exportWord(project: Project, records: RecordItem[], title: string) {
  const sections = records.map((record) => `
    <section class="record">
      <p class="eyebrow">${escapeHtml(record.id)} · ${escapeHtml(record.type)} · ${escapeHtml(record.system)}</p>
      <h1>${escapeHtml(record.title)}</h1>
      <table><tr><th>Status</th><td>${escapeHtml(record.status)}</td><th>Owner</th><td>${escapeHtml(record.owner)}</td></tr>
      <tr><th>Reviewer</th><td colspan="3">${escapeHtml(record.reviewer)}</td></tr></table>
      <h2>Problem or purpose</h2><p>${escapeHtml(record.problem || "Not completed.")}</p>
      ${(templateFields[record.type] ?? []).map((field) => `<h2>${escapeHtml(field.label)}</h2><p>${escapeHtml(record.details[field.key] || "Not completed.")}</p>`).join("")}
    </section>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{margin:22mm} body{font-family:Arial,sans-serif;color:#1c2226;font-size:10.5pt;line-height:1.5}
    .cover{padding-top:50mm;page-break-after:always}.brand,.eyebrow{color:#d71920;font-weight:bold;letter-spacing:.08em}
    h1{font-size:24pt;line-height:1.15;margin:8pt 0 12pt}h2{font-size:13pt;margin:18pt 0 5pt;border-bottom:1px solid #ddd;padding-bottom:4pt}
    .meta{color:#596269}.objective{background:#f1f3f4;padding:12pt;border-left:4px solid #d71920}
    .record{page-break-before:always}table{width:100%;border-collapse:collapse;margin:10pt 0 18pt}th,td{border:1px solid #cfd4d7;padding:6pt;text-align:left}th{background:#f2f4f5;width:18%}
  </style></head><body><section class="cover"><p class="brand">UIR MOTORSPORTS</p><h1>${escapeHtml(title)}</h1>
    <p class="meta">${escapeHtml(project.name)} · ${escapeHtml(project.code)} · ${escapeHtml(project.season)}<br>${escapeHtml(project.competition)} · ${escapeHtml(project.vehicleClass)}<br>Generated ${new Date().toLocaleDateString("en-GB")}</p>
    <h2>Project objective</h2><p class="objective">${escapeHtml(project.objective || "Not defined.")}</p></section>${sections}</body></html>`;
  downloadBlob(new Blob([html], { type: "application/msword;charset=utf-8" }), `${safeFileName(title)}.doc`);
}
async function exportPdf(project: Project, records: RecordItem[], title: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const left = 18;
  const width = 174;
  let y = 20;
  const write = (text: string, size = 10, bold = false, gap = 5) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(text || "Not completed.", width) as string[];
    if (y + lines.length * gap > 280) { pdf.addPage(); y = 20; }
    pdf.text(lines, left, y);
    y += lines.length * gap + 2;
  };
  pdf.setTextColor(215, 25, 32); write("UIR MOTORSPORTS", 11, true);
  pdf.setTextColor(20, 24, 28); write(title, 22, true, 8);
  write(`${project.name} · ${project.code} · ${project.season}`, 10, true);
  write(`${project.competition} · ${project.vehicleClass}`, 9);
  y += 4; write("Project objective", 14, true, 6); write(project.objective, 10, false, 5);
  for (const record of records) {
    pdf.addPage(); y = 20;
    pdf.setTextColor(215, 25, 32); write(record.id, 9, true);
    pdf.setTextColor(20, 24, 28); write(record.title, 18, true, 7);
    write(`${record.type} · ${record.system} · ${record.status}`, 9, true);
    write(`Owner: ${record.owner} | Reviewer: ${record.reviewer}`, 9);
    y += 3; write("Problem or purpose", 13, true, 6); write(record.problem);
    for (const field of templateFields[record.type] ?? []) {
      y += 2; write(field.label, 12, true, 6); write(record.details[field.key] || "Not completed.");
    }
  }
  pdf.save(`${safeFileName(title)}.pdf`);
}
function safeFileName(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "") || "UIR_Motorsports_Document";
}
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}
function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url; link.download = filename; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
