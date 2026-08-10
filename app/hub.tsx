"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { canEdit as canEditUser, isOfficialRole, userOfficialRoles, type AppUser } from "./roles";
import { ApprovalMatrixView, MyWorkView, NotificationsView, ProjectStructureView, RequestsView, TasksView } from "./workspace/Modules";

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
  createdAt?: string;
  sha256?: string | null;
};

type ReviewItem = {
  id: string;
  reviewerUserId?: string;
  reviewerName: string;
  requestedChanges: string;
  comment: string;
  proposedTitle?: string | null;
  proposedSystem?: string | null;
  proposedProblem?: string | null;
  proposedDetailsJson?: string | null;
  status: string;
  reviewRound: number;
  dueAt?: string | null;
  createdAt: string;
};

type RecordEventItem = {
  id: string;
  actorUserId?: string | null;
  type: string;
  payloadJson: string;
  createdAt: string;
};
type ApprovalStepItem = { id: string; reviewerUserId: string; stepOrder: number; status: string; comment: string; decidedAt?: string | null };
type RelatedRecord = { id: string; title: string; status: string; system: string };

type RecordItem = {
  id: string;
  projectId: string;
  title: string;
  type: string;
  system: string;
  owner: string;
  ownerUserId?: string;
  submittedRole: string;
  department: string;
  subprojectId?: string | null;
  componentId?: string | null;
  description: string;
  priority: string;
  dueAt?: string | null;
  responsibleUserIds: string[];
  supervisorUserId?: string | null;
  approverUserIds: string[];
  competitionRelated: boolean;
  revision: number;
  reviewer: string;
  reviewerUserId?: string;
  reviewerUserIds: string[];
  reviewSubmittedAt?: string | null;
  status: "Draft" | "Submitted" | "In review" | "Approved" | "Returned" | "Rejected" | "Closed" | "Archived" | "Cancelled" | "Overdue";
  problem: string;
  details: Record<string, string>;
  completeness: number;
  reviewRound: number;
  reviewDueAt?: string | null;
  approvalChainJson?: string;
  overdueAt?: string | null;
  masterApproved?: boolean;
  updatedAt?: string;
  reviewHistory?: ReviewItem[];
  eventHistory?: RecordEventItem[];
  evidenceHistory?: EvidenceItem[];
};

type Draft = {
  title: string;
  type: string;
  system: string;
  reviewer: string;
  reviewerUserId: string;
  reviewerUserIds: string[];
  submittedRole: string;
  department: string;
  subprojectId: string;
  componentId: string;
  description: string;
  priority: string;
  dueAt: string;
  responsibleUserIds: string[];
  supervisorUserId: string;
  approverUserIds: string[];
  competitionRelated: boolean;
  problem: string;
  details: Record<string, string>;
};

type StructureSubproject = { id: string; name: string; code: string; departmentId?: string | null };
type StructureComponent = { id: string; subprojectId: string; name: string; code: string };
type OrganizationPositionOption = { code: string; name: string; positionType: string; department?: string | null };

type Field = {
  key: string;
  label: string;
  prompt: string;
  placeholder: string;
};

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text.trim()) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

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
  ["☷", "My Work"],
  ["◷", "Calendar"],
  ["♙", "Team"],
  ["◆", "Project"],
  ["⌘", "Structure"],
  ["▤", "Records"],
  ["✓", "Review"],
  ["✓", "Tasks"],
  ["↗", "Requests"],
  ["●", "Notifications"],
  ["⚙", "Approvals"],
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
  reviewerUserId: "",
  reviewerUserIds: [],
  problem: "",
  department: "",
  subprojectId: "",
  componentId: "",
  description: "",
  priority: "Normal",
  dueAt: "",
  responsibleUserIds: [],
  supervisorUserId: "",
  approverUserIds: [],
  competitionRelated: false,
  details: Object.fromEntries((templateFields[type] ?? []).map((field) => [field.key, ""])),
  submittedRole: "",
});

export default function Hub({ user }: { user: AppUser }) {
  const canEdit = canEditUser(user);
  const currentUserRoles = userOfficialRoles(user);
  const canCreate = true;
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
  const [bulkMasterSelection, setBulkMasterSelection] = useState<Set<string>>(new Set());
  const [bulkMasterOpen, setBulkMasterOpen] = useState(false);
  const [teamUsers, setTeamUsers] = useState<AppUser[]>([]);
  const [teamRoles, setTeamRoles] = useState<string[]>([]);
  const [teamDepartments, setTeamDepartments] = useState<string[]>([]);
  const [teamPositions, setTeamPositions] = useState<OrganizationPositionOption[]>([]);
  const [overdueEscalationHours, setOverdueEscalationHours] = useState(24);
  const [structureSubprojects, setStructureSubprojects] = useState<StructureSubproject[]>([]);
  const [structureComponents, setStructureComponents] = useState<StructureComponent[]>([]);

  useEffect(() => {
    void loadWorkspace();
    void fetch("/api/users").then((response) => response.ok ? readJson<{ users?: AppUser[]; roles?: string[]; departments?: string[]; positions?: OrganizationPositionOption[] }>(response) : null).then((payload) => { setTeamUsers(payload?.users ?? []); setTeamRoles(payload?.roles ?? []); setTeamDepartments(payload?.departments ?? []); setTeamPositions(payload?.positions ?? []); }).catch(() => undefined);
    void fetch("/api/organization").then((response) => response.ok ? readJson<{ overdueEscalationHours?: number }>(response) : null).then((payload) => { if (payload?.overdueEscalationHours) setOverdueEscalationHours(payload.overdueEscalationHours); }).catch(() => undefined);
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
      const structureResponse = await fetch(`/api/structure?projectId=${encodeURIComponent(activeProject.id)}`);
      const structurePayload = await readJson<{ subprojects?: StructureSubproject[]; components?: StructureComponent[] }>(structureResponse);
      setProject(activeProject);
      setRecords(mapped);
      setStructureSubprojects(structurePayload?.subprojects ?? []);
      setStructureComponents(structurePayload?.components ?? []);
      setReportSelection(new Set(mapped.filter((item) => item.status === "Approved").map((item) => item.id)));
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
    (item) => ["In review", "Overdue"].includes(item.status) && (item.reviewerUserId === user.id || (!item.reviewerUserId && item.reviewerUserIds.includes(user.id))),
  );
  const leaderAccess = canEdit || currentUserRoles.some((role) => role.endsWith("Leader")) || Boolean(user.positions?.some((position) => position.positionType !== "member"));
  const evidenceReady = records.length
    ? Math.round(records.reduce((sum, item) => sum + item.completeness, 0) / records.length)
    : 0;

  function openWizard(type = "Design Decision") {
    setDraft({ ...emptyDraft(type), submittedRole: currentUserRoles[0] ?? "", department: user.departments?.[0] ?? teamDepartments[0] ?? "" });
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
      reviewerUserId: current.reviewerUserId,
      reviewerUserIds: current.reviewerUserIds,
      submittedRole: current.submittedRole,
      department: current.department,
      subprojectId: current.subprojectId,
      componentId: current.componentId,
      description: current.description,
      priority: current.priority,
      dueAt: current.dueAt,
      responsibleUserIds: current.responsibleUserIds,
      supervisorUserId: current.supervisorUserId,
      approverUserIds: current.approverUserIds,
      competitionRelated: current.competitionRelated,
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
          dueAt: draft.dueAt ? new Date(draft.dueAt).toISOString() : null,
          owner: user.displayName,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      const payload = (await response.json()) as { record: Record<string, unknown> };
      const created = mapRecord(payload.record);
      const uploadedEvidence: EvidenceItem[] = [];

      for (const file of pendingFiles) {
        const body = new FormData();
        body.set("recordId", created.id);
        body.set("caption", evidenceCaption);
        body.set("file", file);
        const upload = await fetch("/api/evidence", { method: "POST", body });
        if (!upload.ok) throw new Error("The record saved, but one evidence file did not upload.");
        const uploaded = await upload.json() as { evidence?: EvidenceItem };
        if (uploaded.evidence) uploadedEvidence.push(uploaded.evidence);
      }

      const createdWithEvidence = { ...created, evidenceHistory: uploadedEvidence };
      setRecords((current) => [createdWithEvidence, ...current]);
      setReportSelection((current) => new Set(current));
      setWizardOpen(false);
      setView("Records");
      setSelected(createdWithEvidence);
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
    setReportSelection((current) => {
      const next = new Set(current);
      if (saved.status === "Approved") next.add(saved.id);
      else next.delete(saved.id);
      return next;
    });
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

  const reportRecords = records.filter((item) => item.status === "Approved" && reportSelection.has(item.id));

  function openRecordById(id: string) {
    const found = records.find((record) => record.id === id);
    if (found) setSelected(found);
    else setError("That document is not available in your current workspace.");
  }

  return (
    <main className="hub">
      <header className="topbar">
        <button className="brand" onClick={() => setView("Dashboard")} aria-label="Dashboard">
          <Image src="/logo.png" alt="UIR Motorsports" width={76} height={42} priority /><span><strong>UIR Motorsports</strong><small>Documentation Hub</small></span>
        </button>
        <label className="search">
          <span>⌕</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records, systems, evidence…" />
          <kbd>⌘ K</kbd>
        </label>
        <button className="project-chip" onClick={() => setView("Project")}>
          <small>ACTIVE PROJECT</small><strong>{project.name} · {project.season}</strong><span>⌄</span>
        </button>
        <div className="top-actions"><div className="profile"><span>{user.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><span><strong>{user.displayName}</strong><small>{user.roles?.join(" · ") || user.role}</small></span></div><form action="/api/auth/logout" method="post"><button className="sign-out">Sign out</button></form></div>
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
            {records.some((item) => item.ownerUserId === user.id && item.status !== "Approved") && <section className="task-panel"><header><div><small>MY DOCUMENTATION TASKS</small><h2>Records assigned to you</h2></div><span>{records.filter((item) => item.ownerUserId === user.id && item.status !== "Approved").length} open</span></header>{records.filter((item) => item.ownerUserId === user.id && item.status !== "Approved").map((item) => { const deadline = item.reviewDueAt || item.dueAt; return <button key={item.id} onClick={() => setSelected(item)}><div><strong>{item.title}</strong><small>{item.id} · {item.submittedRole || "Role not recorded"} · {item.department || item.system} · {item.status}</small></div><em className={deadline ? deadlineClass(deadline) : "deadline-on-track"}>{deadline ? formatDeadline(deadline) : "No deadline assigned"}</em></button>; })}</section>}
            {loading ? <LoadingState /> : records.length ? (
              <section className="dashboard-grid dashboard-grid-new">
                <Panel label="Active project" title={`${project.name} engineering records`} action={<button onClick={() => setView("Records")}>View all →</button>}>
                  <RecordTable records={filtered.slice(0, 4)} onOpen={setSelected} />
                </Panel>
                <Panel label="Leader action required" title="Review queue" action={<span className="pill">{reviewRecords.length} open</span>}>
                  {reviewRecords.length ? <div className="review-cards">{reviewRecords.slice(0, 4).map((item) => <button key={item.id} onClick={() => setSelected(item)}><span><strong>{item.title}</strong><small>{item.id} · {item.submittedRole || "Role not recorded"} · {item.system}</small></span><Status value={item.status} /></button>)}</div> : <MiniEmpty title="Nothing waiting" copy="Move a completed draft to “In review” when it is ready." />}
                </Panel>
                <Panel label="Programme definition" title="Why this project exists">
                  <div className="objective-card"><p>{project.objective || "Add the programme objective in Project."}</p><button onClick={() => setView("Project")}>Edit project goals →</button></div>
                </Panel>
              </section>
            ) : (
              <section className="onboarding-empty">
                <span>01</span><div><small>YOUR PROJECT IS READY</small><h2>Now add the first real engineering record.</h2><p>Choose a template, answer the guided questions, attach the evidence, and save it inside {project.name}. You can reopen it at any time.</p></div>{canCreate && <button className="primary" onClick={() => openWizard()}>Create first record →</button>}
              </section>
            )}
          </>
        )}

        {view === "My Work" && <MyWorkView projectId={project.id} onOpenRecord={openRecordById} />}

        {view === "Project" && (
          <Module title={`${project.name} project`} intro="The project is the container. All engineering records, evidence and generated reports live inside it.">
            <ProjectEditor project={project} recordCount={records.length} editable={canEdit} onSave={saveProject} onNewRecord={openWizard} />
          </Module>
        )}

        {view === "Structure" && <ProjectStructureView projectId={project.id} canManage={canEdit} />}

        {view === "Team" && (
          <Module title="Team directory" intro="Assign each member a UIR Motorsports role and one or more departments. Department leaders can manage only their own departments.">
            <TeamDirectory currentUser={user} users={teamUsers} roles={teamRoles} departments={teamDepartments} positions={teamPositions} onUpdated={(updated) => setTeamUsers((current) => current.map((item) => item.id === updated.id ? updated : item))} />
            <OrganizationSettings currentUser={user} hours={overdueEscalationHours} onSaved={setOverdueEscalationHours} />
          </Module>
        )}

        {view === "Calendar" && <CalendarView records={records} userId={user.id} canSeeAll={canEdit} onOpen={setSelected} />}

        {view === "Records" && (
          <Module title="Engineering records" intro={`Detailed engineering work stored inside ${project.name} — click any row to open, ${canEdit ? "edit and export it" : "review and export it"}.`} action={<button className="primary" onClick={() => openWizard()}>＋ New record</button>}>
            <section className="wide-panel">
              <header className="filters"><strong>{filtered.length} records</strong><span>{project.code}</span><button onClick={() => exportCsv(records, project)}>Download register (.csv)</button></header>
              {filtered.length ? <RecordTable records={filtered} onOpen={setSelected} /> : <MiniEmpty title="No records yet" copy="A project becomes useful only after you add decisions, calculations, tests, risks and manufacturing evidence." action={<button className="primary small-primary" onClick={() => openWizard()}>Add the first record</button>} />}
            </section>
          </Module>
        )}

        {view === "Tasks" && <TasksView projectId={project.id} records={records} users={teamUsers} departments={teamDepartments} onOpenRecord={openRecordById} />}

        {view === "Requests" && <RequestsView projectId={project.id} records={records} users={teamUsers} departments={teamDepartments} onOpenRecord={openRecordById} />}

        {view === "Notifications" && <NotificationsView />}

        {view === "Approvals" && <ApprovalMatrixView canManage={canEdit} roles={teamRoles} departments={teamDepartments} />}

        {view === "Review" && (
          <Module title="Review control" intro="Open a record, check the engineering details and evidence, then change its status.">
            <section className="review-stats">
              <article><small>AWAITING NEXT AUTHORITY</small><strong>{records.filter((item) => ["In review", "Overdue"].includes(item.status)).length}</strong><span>Sequential organizational review</span></article>
              <article><small>OVERDUE</small><strong>{records.filter((item) => item.status === "Overdue").length}</strong><span>Eligible for escalation</span></article>
              <article><small>APPROVED</small><strong>{records.filter((item) => item.status === "Approved").length}</strong><span>Available for official reports</span></article>
              <article><small>RETURNED FOR REVISION</small><strong>{records.filter((item) => item.status === "Returned").length}</strong><span>Missing or unclear information</span></article>
            </section>
            {leaderAccess && <section className="wide-panel actions master-queue"><header className="filters"><div><strong>Leadership approval queue</strong><span>Overdue documents in your organizational scope</span></div><button className="primary small-primary" disabled={!bulkMasterSelection.size} onClick={() => setBulkMasterOpen(true)}>⚡ Master approve selected ({bulkMasterSelection.size})</button></header>{records.filter((item) => item.status === "Overdue").map((item) => <div className="action-row" key={item.id}><input type="checkbox" checked={bulkMasterSelection.has(item.id)} onChange={() => setBulkMasterSelection((current) => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} /><span>⚡</span><div><strong>{item.title}</strong><small>{item.id} · {item.department || item.system} · Waiting for {item.reviewer || "organizational reviewer"}</small>{(item.reviewDueAt || item.dueAt) && <em className="deadline-overdue">{formatDeadline((item.reviewDueAt || item.dueAt)!)}</em>}</div><button onClick={() => setSelected(item)}>Open</button></div>)}{!records.some((item) => item.status === "Overdue") && <MiniEmpty title="No overdue approvals" copy="Documents become overdue automatically when their review deadline passes." />}</section>}
            <section className="wide-panel actions">
              <header className="filters"><strong>My review queue</strong><span>Only the current position in each automatic chain can approve</span></header>
              {reviewRecords.length ? reviewRecords.map((item) => <div className="action-row" key={item.id}><span>▤</span><div><strong>{item.title}</strong><small>{item.id} · {item.submittedRole || "Role not recorded"} · Round {item.reviewRound || 1} · Reviewer: {item.reviewer}</small>{item.reviewSubmittedAt && <em>Submitted {formatSubmittedAt(item.reviewSubmittedAt)}</em>}{item.reviewDueAt && <em className={deadlineClass(item.reviewDueAt)}>{formatDeadline(item.reviewDueAt)}</em>}</div><div className="completion"><small>{item.completeness}% complete</small><i><b style={{ width: `${item.completeness}%` }} /></i></div><button onClick={() => setSelected(item)}>Open review</button></div>) : <MiniEmpty title="The queue is clear" copy="Returned records must be updated by their owner and submitted again before review resumes." />}
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
                <p className="export-note">Only records approved by every assigned reviewer can be included. Attached evidence is listed by filename and caption.</p>
              </article>
              <article className="report-records">
                <header><div><small>STEP 2 · CONTENT</small><h2>{reportRecords.length} records selected</h2></div><button onClick={() => setReportSelection(new Set(records.filter((item) => item.status === "Approved").map((item) => item.id)))}>Select all approved</button></header>
                {records.map((item) => <label key={item.id} className={`${reportSelection.has(item.id) ? "selected" : ""} ${item.status !== "Approved" ? "locked" : ""}`}><input type="checkbox" disabled={item.status !== "Approved"} checked={item.status === "Approved" && reportSelection.has(item.id)} onChange={() => toggleReportRecord(item.id)} /><span><strong>{item.title}</strong><small>{item.id} · {item.type} · {item.status}{item.status !== "Approved" && " · Waiting for all approvals"}</small></span><b>{item.completeness}%</b></label>)}
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
          roles={currentUserRoles}
          departments={teamDepartments}
          subprojects={structureSubprojects}
          components={structureComponents}
        />
      )}

      {bulkMasterOpen && <BulkMasterApprovalModal records={records.filter((item) => bulkMasterSelection.has(item.id))} onClose={() => setBulkMasterOpen(false)} onCompleted={(updated) => { setRecords((current) => current.map((item) => updated.find((row) => row.id === item.id) ?? item)); setBulkMasterSelection(new Set()); setBulkMasterOpen(false); showNotice(`${updated.length} document${updated.length === 1 ? "" : "s"} Master Approved.`); }} />}

      {selected && (
        <RecordDetail
          key={selected.id}
          record={selected}
          project={project}
          onClose={() => setSelected(null)}
          onSave={saveRecord}
          editable={selected.status !== "Approved" && (canEdit || selected.ownerUserId === user.id)}
          onEvidenceUploaded={(item) => {
            showNotice("Evidence uploaded and attached to this record.");
            if (item) {
              setRecords((current) => current.map((record) => record.id === selected.id ? { ...record, evidenceHistory: [...(record.evidenceHistory ?? []), item] } : record));
              setSelected((current) => current && current.id === selected.id ? { ...current, evidenceHistory: [...(current.evidenceHistory ?? []), item] } : current);
            }
          }}
          currentUser={user}
          currentUserRoles={currentUserRoles}
          availableRecords={records}
          onReviewCompleted={(status, dueAt, review, serverRecord) => {
            const updated = { ...(serverRecord ?? selected), status, reviewDueAt: dueAt, reviewHistory: review ? [review, ...(serverRecord?.reviewHistory ?? selected.reviewHistory ?? [])] : serverRecord?.reviewHistory ?? selected.reviewHistory, eventHistory: selected.eventHistory, evidenceHistory: selected.evidenceHistory } as RecordItem;
            setRecords((current) => current.map((item) => item.id === selected.id ? { ...item, ...updated } : item));
            setReportSelection((current) => {
              const next = new Set(current);
              if (status === "Approved") next.add(selected.id);
              else next.delete(selected.id);
              return next;
            });
            setSelected(updated);
          }}
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
  const reviewerUserId = typeof item.reviewerUserId === "string" ? item.reviewerUserId : undefined;
  const reviewerUserIds = parseStringArray(item.reviewerUserIds);
  if (!reviewerUserIds.length && reviewerUserId) reviewerUserIds.push(reviewerUserId);
  return {
    id: String(item.id),
    projectId: String(item.projectId ?? "HOPE-2027"),
    title: String(item.title ?? "Untitled record"),
    type: String(item.type ?? "Design Decision"),
    system: String(item.system ?? "Whole Vehicle"),
    owner: String(item.owner ?? "Unknown"),
    ownerUserId: typeof item.ownerUserId === "string" ? item.ownerUserId : undefined,
    submittedRole: String(item.submittedRole ?? ""),
    department: String(item.department ?? ""),
    subprojectId: typeof item.subprojectId === "string" ? item.subprojectId : null,
    componentId: typeof item.componentId === "string" ? item.componentId : null,
    description: String(item.description ?? ""),
    priority: String(item.priority ?? "Normal"),
    dueAt: typeof item.dueAt === "string" ? item.dueAt : null,
    responsibleUserIds: parseStringArray(item.responsibleUserIds),
    supervisorUserId: typeof item.supervisorUserId === "string" ? item.supervisorUserId : null,
    approverUserIds: parseStringArray(item.approverUserIds),
    competitionRelated: Boolean(item.competitionRelated),
    revision: Number(item.revision ?? 1),
    reviewer: String(item.reviewer ?? "Department Leader"),
    reviewerUserId,
    reviewerUserIds,
    reviewSubmittedAt: typeof item.reviewSubmittedAt === "string" ? item.reviewSubmittedAt : null,
    status: String(item.status ?? "Draft") as RecordItem["status"],
    problem: String(item.problem ?? ""),
    details,
    completeness: Number(item.completeness ?? 0),
    reviewRound: Number(item.reviewRound ?? 0),
    reviewDueAt: typeof item.reviewDueAt === "string" ? item.reviewDueAt : null,
    approvalChainJson: typeof item.approvalChainJson === "string" ? item.approvalChainJson : "[]",
    overdueAt: typeof item.overdueAt === "string" ? item.overdueAt : null,
    masterApproved: Boolean(item.masterApproved),
    updatedAt: item.updatedAt ? String(item.updatedAt) : undefined,
    reviewHistory: parseReviewHistory(item.reviewHistory),
    eventHistory: parseEventHistory(item.eventHistory),
    evidenceHistory: parseEvidenceHistory(item.evidenceHistory),
  };
}

function parseReviewHistory(value: unknown): ReviewItem[] {
  return Array.isArray(value) ? value.filter((item): item is ReviewItem => Boolean(item && typeof item === "object")) : [];
}

function parseEventHistory(value: unknown): RecordEventItem[] {
  return Array.isArray(value) ? value.filter((item): item is RecordEventItem => Boolean(item && typeof item === "object")) : [];
}

function parseEvidenceHistory(value: unknown): EvidenceItem[] {
  return Array.isArray(value) ? value.filter((item): item is EvidenceItem => Boolean(item && typeof item === "object")) : [];
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
  roles,
  departments,
  subprojects,
  components,
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
  roles: string[];
  departments: string[];
  subprojects: StructureSubproject[];
  components: StructureComponent[];
}) {
  const fields = templateFields[draft.type] ?? [];
  const canContinue =
    step === 1 ? Boolean(draft.title.trim() && draft.problem.trim() && draft.submittedRole) :
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
              <div className="form-grid"><label>Department<select value={draft.department} onChange={(event) => onDraft({ ...draft, department: event.target.value })}><option value="">Choose department</option>{departments.map((department) => <option key={department}>{department}</option>)}</select></label><label>Working role<select required value={draft.submittedRole} onChange={(event) => onDraft({ ...draft, submittedRole: event.target.value })}><option value="">Choose the role used for this work</option>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select><small>Choose the official role you are working under for this record.</small></label></div>
              <div className="form-grid"><label>Sub-project<select value={draft.subprojectId} onChange={(event) => { const selected = subprojects.find((item) => item.id === event.target.value); onDraft({ ...draft, subprojectId: event.target.value, system: selected?.name || event.target.value, componentId: "" }); }}><option value="">Choose sub-project</option>{subprojects.map((subproject) => <option key={subproject.id} value={subproject.id}>{subproject.name} · {subproject.code}</option>)}{!subprojects.length && systems.map((system) => <option key={system} value={system}>{system}</option>)}</select></label><label>Component / work package<select value={draft.componentId} onChange={(event) => onDraft({ ...draft, componentId: event.target.value })}><option value="">No component selected</option>{components.filter((component) => !draft.subprojectId || component.subprojectId === draft.subprojectId).map((component) => <option key={component.id} value={component.id}>{component.name} · {component.code}</option>)}</select></label></div>
              <div className="form-grid"><label>Priority<select value={draft.priority} onChange={(event) => onDraft({ ...draft, priority: event.target.value })}><option>Low</option><option>Normal</option><option>High</option><option>Critical</option></select></label><label>Document deadline<input type="datetime-local" value={draft.dueAt} onChange={(event) => onDraft({ ...draft, dueAt: event.target.value })} /><small>Select an exact date and time, including hours.</small></label></div>
              <div className="automatic-routing-note"><strong>Automatic approval routing</strong><p>The department head, branch leader and higher authorities are chosen from the fixed organizational hierarchy. No supervisor or reviewer selection is needed.</p></div>
              <label>Document description<textarea value={draft.description} onChange={(event) => onDraft({ ...draft, description: event.target.value })} placeholder="What is this document for, and what should a future engineer understand?" /></label>
              <label className="checkbox-label"><input type="checkbox" checked={draft.competitionRelated} onChange={(event) => onDraft({ ...draft, competitionRelated: event.target.checked })} /> Competition submission related</label>
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
              <dl><div><dt>Template</dt><dd>{draft.type}</dd></div><div><dt>Department</dt><dd>{draft.department || "Not assigned"}</dd></div><div><dt>Sub-project</dt><dd>{draft.system}</dd></div><div><dt>Component</dt><dd>{components.find((component) => component.id === draft.componentId)?.name || "Not assigned"}</dd></div><div><dt>Working role</dt><dd>{draft.submittedRole}</dd></div><div><dt>Approval route</dt><dd>Automatic organizational hierarchy</dd></div><div><dt>Priority / deadline</dt><dd>{draft.priority} · {draft.dueAt ? new Date(draft.dueAt).toLocaleString() : "Not assigned"}</dd></div><div><dt>Answered questions</dt><dd>{Object.values(draft.details).filter((value) => value.trim()).length} / {fields.length}</dd></div><div><dt>Evidence files</dt><dd>{files.length}</dd></div><div><dt>Initial status</dt><dd>Draft</dd></div></dl>
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
  editable,
  currentUser,
  currentUserRoles,
  availableRecords,
  onReviewCompleted,
}: {
  record: RecordItem;
  project: Project;
  onClose: () => void;
  onSave: (record: RecordItem) => Promise<void>;
  onEvidenceUploaded: (item?: EvidenceItem) => void;
  editable: boolean;
  currentUser: AppUser;
  currentUserRoles: string[];
  availableRecords: RecordItem[];
  onReviewCompleted: (status: RecordItem["status"], dueAt: string | null, review?: ReviewItem, serverRecord?: RecordItem) => void;
}) {
  const [editing, setEditing] = useState(record);
  const [tab, setTab] = useState<"details" | "evidence" | "export">("details");
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<EvidenceItem | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewChanges, setReviewChanges] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [relatedRecords, setRelatedRecords] = useState<RelatedRecord[]>([]);
  const [relationTarget, setRelationTarget] = useState("");
  const [relationType, setRelationType] = useState("Related to");
  const [reviewDueAt, setReviewDueAt] = useState(record.reviewDueAt ?? "");
  const [masterAllowed, setMasterAllowed] = useState(false);
  const [masterOpen, setMasterOpen] = useState(false);
  const [masterReason, setMasterReason] = useState("Report overdue");
  const [masterComment, setMasterComment] = useState("");
  const [masterMessage, setMasterMessage] = useState("");
  const [approvalSteps, setApprovalSteps] = useState<ApprovalStepItem[]>([]);
  const canReview = record.reviewerUserId === currentUser.id || (!record.reviewerUserId && record.reviewerUserIds.includes(currentUser.id));
  const sealed = ["Approved", "Closed", "Archived"].includes(record.status);
  const reviewMode = !sealed && canReview && ["In review", "Overdue"].includes(record.status);
  const fields = templateFields[editing.type] ?? [];

  useEffect(() => {
    void fetch(`/api/evidence?recordId=${encodeURIComponent(record.id)}`)
      .then((response) => response.json())
      .then((payload: { evidence?: EvidenceItem[] }) => setEvidence(payload.evidence ?? []))
      .catch(() => setMessage("Evidence could not be loaded."));
    void fetch(`/api/reviews?recordId=${encodeURIComponent(record.id)}`)
      .then((response) => readJson<{ reviews?: ReviewItem[] }>(response))
      .then((payload) => setReviews(payload?.reviews ?? []))
      .catch(() => setReviewMessage("Reviews could not be loaded."));
    void fetch(`/api/records/${encodeURIComponent(record.id)}/relationships`)
      .then((response) => readJson<{ related?: RelatedRecord[] }>(response))
      .then((payload) => setRelatedRecords(payload?.related ?? []))
      .catch(() => undefined);
    void fetch(`/api/records/${encodeURIComponent(record.id)}`)
      .then((response) => readJson<{ permissions?: { canMasterApprove?: boolean } }>(response))
      .then((payload) => setMasterAllowed(Boolean(payload?.permissions?.canMasterApprove)))
      .catch(() => setMasterAllowed(false));
    void fetch(`/api/records/${encodeURIComponent(record.id)}`)
      .then((response) => readJson<{ steps?: ApprovalStepItem[] }>(response))
      .then((payload) => setApprovalSteps(payload?.steps ?? []))
      .catch(() => setApprovalSteps([]));
  }, [record.id]);

  async function addRelationship() {
    if (!relationTarget) return;
    const response = await fetch(`/api/records/${encodeURIComponent(record.id)}/relationships`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetRecordId: relationTarget, relationshipType: relationType }) });
    const payload = await readJson<{ related?: RelatedRecord[]; error?: string }>(response);
    if (!response.ok) { setMessage(payload?.error || "The document relationship could not be saved."); return; }
    const target = availableRecords.find((item) => item.id === relationTarget);
    if (target) setRelatedRecords((current) => [...current, target]);
    setRelationTarget(""); setMessage("Document relationship saved.");
  }

  async function save() {
    setBusy(true); setMessage("");
    try { await onSave(editing); setMessage("Saved."); }
    catch (caught) { setMessage(caught instanceof Error ? caught.message : "Could not save."); }
    finally { setBusy(false); }
  }

  async function submitForReview() {
    setBusy(true); setMessage("");
    try {
      await onSave({ ...editing, status: "In review" });
      setEditing((current) => ({ ...current, status: "In review" }));
      setMessage("Sent to the assigned reviewer.");
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Could not submit for review."); }
    finally { setBusy(false); }
  }

  async function saveReview(outcome: "Changes requested" | "Accepted" | "Rejected") {
    setBusy(true); setReviewMessage("");
    try {
      const response = await fetch("/api/reviews", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recordId: record.id, requestedChanges: reviewChanges, comment: reviewComment, proposedTitle: editing.title, proposedSystem: editing.system, proposedProblem: editing.problem, proposedDetails: editing.details, dueAt: reviewDueAt || null, status: outcome }) });
      const payload = await readJson<{ review?: ReviewItem; record?: Record<string, unknown>; recordStatus?: RecordItem["status"]; approvalsReceived?: number; approvalsRequired?: number; error?: string }>(response);
      if (!response.ok || !payload?.review) throw new Error(payload?.error || "Review could not be saved.");
      setReviews((current) => [payload.review!, ...current]);
      const nextRecordStatus: RecordItem["status"] = payload.recordStatus ?? (outcome === "Accepted" ? "Approved" : outcome === "Rejected" ? "Rejected" : "Returned");
      setEditing((current) => ({ ...current, status: nextRecordStatus }));
      onReviewCompleted(nextRecordStatus, reviewDueAt || null, payload.review, payload.record ? mapRecord(payload.record) : undefined);
      setReviewChanges(""); setReviewComment(""); setReviewMessage(outcome === "Accepted" && nextRecordStatus === "In review" ? `Approval recorded: ${payload.approvalsReceived}/${payload.approvalsRequired} reviewers approved. Waiting for the remaining reviewer(s).` : outcome === "Accepted" ? "All reviewers approved this record." : outcome === "Rejected" ? "Record rejected and sealed from further edits." : "Review completed; changes were returned to the record owner.");
    } catch (error) { setReviewMessage(error instanceof Error ? error.message : "Review could not be saved."); }
    finally { setBusy(false); }
  }

  async function confirmMasterApproval() {
    setBusy(true); setMasterMessage("");
    try {
      const response = await fetch("/api/master-approvals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recordId: record.id, reason: masterReason, comment: masterComment }) });
      const payload = await readJson<{ approved?: Record<string, unknown>[]; error?: string }>(response);
      if (!response.ok || !payload?.approved?.[0]) throw new Error(payload?.error || "Master Approval could not be completed.");
      const updated = mapRecord(payload.approved[0]);
      setEditing(updated);
      void fetch(`/api/records/${encodeURIComponent(record.id)}`).then((response) => readJson<{ steps?: ApprovalStepItem[] }>(response)).then((payload) => setApprovalSteps(payload?.steps ?? []));
      setMasterOpen(false);
      setMasterMessage("");
      onReviewCompleted(updated.status, updated.reviewDueAt ?? null);
      setReviewMessage(updated.status === "Approved" ? "Master Approval completed and the record is sealed." : "Master Approval recorded. The document is now waiting for the next higher authority.");
    } catch (error) { setMasterMessage(error instanceof Error ? error.message : "Master Approval could not be completed."); }
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
      onEvidenceUploaded(payload.evidence);
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Upload failed."); }
    finally { setBusy(false); }
  }

  const exportRecord: RecordItem = {
    ...editing,
    reviewHistory: reviews.length ? reviews : record.reviewHistory,
    eventHistory: record.eventHistory,
    evidenceHistory: evidence.length ? evidence : record.evidenceHistory,
  };

  return (
    <div className="overlay detail-overlay" onMouseDown={onClose}>
      <section className="record-detail" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header className="detail-header"><div><small>{record.id} · {project.code}</small><input disabled={sealed || (!editable && !canReview)} value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /><p>{editing.type} · Sub-project: {editing.system} · Working role: {editing.submittedRole || "Not recorded"}</p></div><button onClick={onClose} aria-label="Close">×</button></header>
        <nav className="detail-tabs"><button className={tab === "details" ? "active" : ""} onClick={() => setTab("details")}>Guided details</button><button className={tab === "evidence" ? "active" : ""} onClick={() => setTab("evidence")}>Evidence <b>{evidence.length}</b></button><button className={tab === "export" ? "active" : ""} onClick={() => setTab("export")}>Export</button></nav>
        <div className="detail-body">
          {sealed && <div className="sealed-notice"><strong>SEALED APPROVED RECORD</strong><p>This record is locked because every assigned reviewer approved it. Its review history remains available for audit and export. Create a new record if further work is required.</p></div>}
          {masterAllowed && !sealed && ["In review", "Overdue"].includes(editing.status) && <section className="master-action-bar"><div><small>LEADERSHIP OVERRIDE</small><strong>{editing.status === "Overdue" ? "Overdue approval" : "Master Approval available"}</strong><p>Skip only the pending approvals below your organizational position. Higher authorities remain in the chain.</p></div><button className="secondary master-button" onClick={() => setMasterOpen(true)}>⚡ Master Approve</button></section>}
          {approvalSteps.length > 0 && <section className="approval-chain"><header><div><small>AUTOMATIC APPROVAL CHAIN</small><h3>{approvalSteps.filter((step) => step.status === "Pending").length ? "Sequential approval in progress" : "Approval chain complete"}</h3></div><span>{approvalSteps.length} position{approvalSteps.length === 1 ? "" : "s"}</span></header>{approvalSteps.map((step) => { const chain = parseApprovalChain(editing.approvalChainJson); const position = chain.find((item) => item.userId === step.reviewerUserId); return <div className={`approval-step approval-${step.status.toLowerCase()}`} key={step.id}><b>{String(step.stepOrder).padStart(2, "0")}</b><div><strong>{position?.positionName || "Organizational approver"}</strong><small>{position?.userName || step.reviewerUserId}</small></div><span>{step.status === "BYPASSED" ? "BYPASSED BY MASTER APPROVAL" : step.status === "MASTER_APPROVED" ? "MASTER APPROVED" : step.status}</span></div>; })}</section>}
          {message && <div className="inline-message">{message}</div>}
          {tab === "details" && (
            <div className="detail-form">
              <section className="record-meta">
                <label>Status<select disabled={!editable || sealed} value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value as RecordItem["status"] })}><option>Draft</option><option>In review</option>{["Approved", "Rejected", "Closed", "Archived", "Cancelled", "Overdue"].includes(editing.status) && <option>{editing.status}</option>}<option>Returned</option></select></label>
                <label>Department<input disabled={sealed || !editable} value={editing.department} onChange={(event) => setEditing({ ...editing, department: event.target.value })} /></label>
                <label>Sub-project<select disabled={sealed || (!editable && !canReview)} value={editing.system} onChange={(event) => setEditing({ ...editing, system: event.target.value })}>{systems.map((system) => <option key={system}>{system}</option>)}</select></label>
                <label>Priority<select disabled={sealed || !editable} value={editing.priority} onChange={(event) => setEditing({ ...editing, priority: event.target.value })}><option>Low</option><option>Normal</option><option>High</option><option>Critical</option></select></label>
                <label>Document deadline<input disabled={sealed || !editable} type="datetime-local" value={toDateTimeLocal(editing.dueAt)} onChange={(event) => setEditing({ ...editing, dueAt: event.target.value ? new Date(event.target.value).toISOString() : null })} /></label>
                <label>Working role<select disabled={sealed || !editable} value={editing.submittedRole} onChange={(event) => setEditing({ ...editing, submittedRole: event.target.value })}><option value="">Choose the role used for this work</option>{currentUserRoles.map((role) => <option key={role} value={role}>{role}</option>)}{editing.submittedRole && !currentUserRoles.includes(editing.submittedRole) && <option value={editing.submittedRole}>{editing.submittedRole}</option>}</select><small>This is the role under which this record was submitted.</small></label>
                <label>Approval route<input disabled value={editing.reviewer || "Automatic organizational hierarchy"} /><small>Reviewers are resolved from organizational positions and cannot be assigned manually.</small></label>
              </section>
              <label className="problem-field">Document description<textarea disabled={sealed || !editable} value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} placeholder="Purpose and future engineering context" /></label>
              <section className="related-records"><header><div><small>DOCUMENT RELATIONSHIPS</small><h3>{relatedRecords.length ? `${relatedRecords.length} linked documents` : "No linked documents"}</h3></div></header>{relatedRecords.map((related) => <button key={related.id} type="button" onClick={() => setMessage(`${related.title} · ${related.status}`)}><strong>{related.title}</strong><small>{related.id} · {related.system} · {related.status}</small></button>)}{editable && <div className="related-add"><select value={relationTarget} onChange={(event) => setRelationTarget(event.target.value)}><option value="">Link another document</option>{availableRecords.filter((item) => item.id !== record.id && !relatedRecords.some((related) => related.id === item.id)).map((item) => <option key={item.id} value={item.id}>{item.title} · {item.id}</option>)}</select><select value={relationType} onChange={(event) => setRelationType(event.target.value)}><option>Related to</option><option>Depends on</option><option>Supersedes</option><option>Evidence for</option></select><button className="secondary" type="button" onClick={() => void addRelationship()}>Link</button></div>}</section>
              <label className="problem-field">Problem or purpose<textarea disabled={sealed || (!editable && !canReview)} value={editing.problem} onChange={(event) => setEditing({ ...editing, problem: event.target.value })} /></label>
              <div className="guided-fields compact">{fields.map((field, index) => <label key={field.key}><span><b>{String(index + 1).padStart(2, "0")}</b><strong>{field.label}</strong></span><small>{field.prompt}</small><textarea disabled={sealed || (!editable && !canReview)} value={editing.details[field.key] ?? ""} onChange={(event) => setEditing({ ...editing, details: { ...editing.details, [field.key]: event.target.value } })} placeholder={field.placeholder} /></label>)}</div>
            </div>
          )}
          {tab === "evidence" && (
            <div className="evidence-tab">
              <form className="upload-card" onSubmit={upload}>
                <small>ADD EVIDENCE TO {record.id}</small><h3>Upload a supporting file</h3><p>A useful caption explains what the file proves, not only what it is.</p>
                <input disabled={sealed || !editable} type="file" required onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
                <textarea disabled={sealed || !editable} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Caption: what does this evidence demonstrate?" />
                {editable && <button className="primary" disabled={busy || !uploadFile}>Upload and attach</button>}
              </form>
              <section className="evidence-list"><header><small>ATTACHED TO THIS RECORD</small><h3>{evidence.length} evidence files</h3></header>{evidence.map((item) => <article key={item.id}><span>□</span><div><strong>{item.filename}</strong><small>{formatBytes(item.size)} · {item.contentType}</small><p>{item.caption || "No caption provided."}</p></div><div className="evidence-actions"><button type="button" onClick={() => setPreview(item)}>Preview</button><a href={`/api/evidence/${item.id}`} download={item.filename}>Download</a></div></article>)}{!evidence.length && <MiniEmpty title="No evidence attached" copy="Choose a document, result sheet, drawing or image above." />}</section>
            </div>
          )}
          {tab === "export" && (
            <div className="single-export">
              <span>▥</span><small>GENERATE FROM THIS SAVED RECORD</small><h2>{record.title}</h2><p>{editing.status === "Approved" ? "The export includes project identity, record metadata, the problem statement, every guided answer, approval status and an evidence register." : "This record is not export-ready yet. Every assigned reviewer must approve it before the official Word and PDF exports become available."}</p>
              <div><button className="primary" disabled={editing.status !== "Approved"} onClick={() => exportWord(project, [exportRecord], editing.title)}>Download Word (.doc)</button><button className="secondary" disabled={editing.status !== "Approved"} onClick={() => void exportPdf(project, [exportRecord], editing.title)}>Download PDF</button></div>
            </div>
          )}
          {tab === "details" && reviewMode && (
            <section className="review-comment-box">
              <small>REVIEW SUBMISSION · ROUND {record.reviewRound || 1}</small><h3>Review the proposed answers</h3><p>Make proposed edits in the copied answer fields above, then choose an outcome below.</p>
              <textarea value={reviewChanges} onChange={(event) => setReviewChanges(event.target.value)} placeholder="Changes needed…" />
              <textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="Why are these changes needed?" />
              <label>Return deadline<input type="datetime-local" value={toDateTimeLocal(reviewDueAt)} onChange={(event) => setReviewDueAt(event.target.value || "")} /></label>
              <div className="review-actions"><button className="secondary" disabled={busy || !reviewChanges.trim()} onClick={() => void saveReview("Changes requested")}>↩ Send back for changes</button><button className="secondary" disabled={busy || !reviewComment.trim()} onClick={() => void saveReview("Rejected")}>× Reject record</button><button className="primary" disabled={busy} onClick={() => void saveReview("Accepted")}>✓ Approve review</button>{masterAllowed && <button className="secondary master-button" disabled={busy} onClick={() => setMasterOpen(true)}>⚡ Master Approve</button>}</div>{reviewMessage && <p>{reviewMessage}</p>}
            </section>
          )}
          {reviews.length > 0 && <section className="review-history"><small>REVIEW SUB-RECORDS</small>{reviews.map((review) => <article key={review.id}><header><strong>Round {review.reviewRound} · {review.status}</strong><span>{review.reviewerName} · {new Date(review.createdAt).toLocaleString()}</span></header>{review.dueAt && <p className={deadlineClass(review.dueAt)}><b>Deadline:</b> {formatDeadline(review.dueAt)}</p>}<p><b>What changed:</b> {review.requestedChanges || "No change summary provided."}</p><p><b>Why:</b> {review.comment || "No reason provided."}</p><details><summary>View proposed answers</summary><div className="review-proposed"><label>Proposed title<strong>{review.proposedTitle || "—"}</strong></label><label>Proposed problem<strong>{review.proposedProblem || "—"}</strong></label>{Object.entries(parseReviewDetails(review.proposedDetailsJson)).map(([key, value]) => <label key={key}>{formatReviewLabel(key)}<strong>{value || "—"}</strong></label>)}</div></details></article>)}</section>}
          {record.eventHistory && record.eventHistory.length > 0 && <section className="review-history audit-history"><small>AUDIT TRAIL</small>{record.eventHistory.map((event) => { const payload = parseEventPayload(event.payloadJson); const changes = buildAuditChanges(event, payload); return <article key={event.id}><header><strong>{formatReviewLabel(event.type)}</strong><span>{formatExportDate(event.createdAt)} · {auditActor(event, payload)}</span></header><div className="audit-summary">{changes.map((change) => <div className="audit-change" key={`${event.id}-${change.label}`}><strong>{change.label}</strong>{change.before !== undefined && <span className="audit-before">Before: {change.before}</span>}<span>{change.before !== undefined ? "After: " : "Recorded: "}{change.after}</span></div>)}</div><details><summary>View technical event data</summary><pre>{JSON.stringify(payload, null, 2)}</pre></details></article>; })}</section>}
        </div>
        <footer className="detail-footer"><span>{editing.completeness}% complete · {editing.status}{sealed ? " · Sealed" : !editable ? " · Read only" : ""}</span><div><button className="secondary" onClick={onClose}>Close</button>{editable && !sealed && !reviewMode && tab === "details" && <>{editing.status !== "In review" && <button className="secondary" disabled={busy} onClick={() => void submitForReview()}>Send for review</button>}<button className="primary" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save changes"}</button></>}</div></footer>
      </section>
      {masterOpen && <div className="overlay" onMouseDown={() => setMasterOpen(false)}><section className="modal master-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><small>MASTER APPROVAL</small><h2>Override the normal approval hierarchy</h2></div><button onClick={() => setMasterOpen(false)}>×</button></header><div className="master-summary"><strong>{editing.title}</strong><span>{editing.department || "No department"} · {editing.status}</span><span>Current reviewer: {editing.reviewer || "Automatic organizational chain"}</span><span>Due: {editing.reviewDueAt ? formatDeadline(editing.reviewDueAt) : "No review deadline assigned"}</span></div><label>Reason for Master Approval<select value={masterReason} onChange={(event) => setMasterReason(event.target.value)}><option>Report overdue</option><option>Reviewer unavailable</option><option>Competition deadline</option><option>Urgent manufacturing requirement</option><option>Urgent procurement requirement</option><option>Technical decision required</option><option>Administrative delay</option><option>Other</option></select></label><label>Comment / explanation<textarea value={masterComment} onChange={(event) => setMasterComment(event.target.value)} placeholder={editing.status === "Overdue" ? "Optional context for the audit trail" : "Explain why the normal chain must be overridden"} /></label>{masterMessage && <p className="inline-message">{masterMessage}</p>}<footer className="wizard-footer"><button className="secondary" onClick={() => setMasterOpen(false)}>Cancel</button><button className="primary master-button" disabled={busy || (editing.status !== "Overdue" && !masterComment.trim())} onClick={() => void confirmMasterApproval()}>Confirm Master Approval</button></footer></section></div>}
      {preview && <div className="overlay" onMouseDown={() => setPreview(null)}><section className="preview-modal" onMouseDown={(event) => event.stopPropagation()}><header><strong>{preview.filename}</strong><div><a className="secondary" href={`/api/evidence/${preview.id}`} download={preview.filename}>Download</a><button onClick={() => setPreview(null)}>×</button></div></header><iframe title={`Preview of ${preview.filename}`} src={`/api/evidence/${preview.id}`} /></section></div>}
    </div>
  );
}

function BulkMasterApprovalModal({ records, onClose, onCompleted }: { records: RecordItem[]; onClose: () => void; onCompleted: (records: RecordItem[]) => void }) {
  const [reason, setReason] = useState("Report overdue");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/master-approvals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recordIds: records.map((record) => record.id), reason, comment }) });
      const payload = await readJson<{ approved?: Record<string, unknown>[]; error?: string }>(response);
      if (!response.ok || !payload?.approved) throw new Error(payload?.error || "Bulk Master Approval could not be completed.");
      onCompleted(payload.approved.map(mapRecord));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Bulk Master Approval could not be completed."); }
    finally { setBusy(false); }
  }
  return <div className="overlay" onMouseDown={onClose}><section className="modal master-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><small>BULK MASTER APPROVAL</small><h2>Override {records.length} overdue document{records.length === 1 ? "" : "s"}</h2></div><button onClick={onClose}>×</button></header><div className="master-summary"><strong>{records.length} documents selected</strong>{records.map((record) => <span key={record.id}>{record.title} · {record.department || "No department"} · {record.reviewer || "Waiting for organizational reviewer"}</span>)}</div><label>Reason for Master Approval<select value={reason} onChange={(event) => setReason(event.target.value)}><option>Report overdue</option><option>Reviewer unavailable</option><option>Competition deadline</option><option>Urgent manufacturing requirement</option><option>Urgent procurement requirement</option><option>Technical decision required</option><option>Administrative delay</option><option>Other</option></select></label><label>Comment / explanation<textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add the shared audit explanation" /></label>{message && <p className="inline-message">{message}</p>}<footer className="wizard-footer"><button className="secondary" onClick={onClose}>Cancel</button><button className="primary master-button" disabled={busy} onClick={() => void confirm()}>Confirm Master Approval</button></footer></section></div>;
}

function parseApprovalChain(value: string | null | undefined): Array<{ userId: string; userName: string; positionName: string }> {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is { userId: string; userName: string; positionName: string } => Boolean(item && typeof item === "object" && typeof (item as Record<string, unknown>).userId === "string")) : [];
  } catch { return []; }
}

function parseReviewDetails(value: string | null | undefined): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).map(([key, item]) => [key, typeof item === "string" ? item : String(item ?? "")]));
  } catch { return {}; }
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];
  try { return parseStringArray(JSON.parse(value)); } catch { return value ? [value] : []; }
}

function CalendarView({ records, userId, canSeeAll, onOpen }: { records: RecordItem[]; userId: string; canSeeAll: boolean; onOpen: (record: RecordItem) => void }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const visible = records.filter((record) => canSeeAll || record.ownerUserId === userId || record.reviewerUserIds.includes(userId) || record.reviewerUserId === userId);
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, index) => index - firstDay + 1);
  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const recordDeadline = (record: RecordItem) => record.reviewDueAt || record.dueAt || null;
  const recordsForDay = (day: number) => visible.filter((record) => recordDeadline(record) && (() => { const due = parseDeadline(recordDeadline(record)!); return due.getFullYear() === month.getFullYear() && due.getMonth() === month.getMonth() && due.getDate() === day; })());
  const noDeadline = visible.filter((record) => !recordDeadline(record) && record.status !== "Approved");

  return <Module title="Deadline calendar" intro={canSeeAll ? "Project-wide review and documentation deadlines across every sub-project." : "Your assigned documentation deadlines and returned work."} action={<button type="button" className="primary" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</button>}>
    <section className="calendar-shell">
      <header className="calendar-toolbar"><button type="button" className="secondary" aria-label="Previous month" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>←</button><h2>{monthLabel}</h2><button type="button" className="secondary" aria-label="Next month" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>→</button></header>
      <div className="calendar-weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <strong key={day}>{day}</strong>)}</div>
      <div className="calendar-grid">{cells.map((day, index) => { const dayRecords = day > 0 && day <= daysInMonth ? recordsForDay(day) : []; return <div className={`calendar-day ${day < 1 || day > daysInMonth ? "outside" : ""}`} key={`${month.toISOString()}-${index}`}><span>{day > 0 && day <= daysInMonth ? day : ""}</span>{dayRecords.map((record) => <button key={record.id} className={deadlineClass(recordDeadline(record)!)} onClick={() => onOpen(record)}><b>{record.title}</b><small>{record.department || record.system} · {record.submittedRole || "Role not recorded"} · R{record.reviewRound || 1}</small><em>{record.status} · {formatSubmittedAt(recordDeadline(record)!)}</em></button>)}</div>; })}</div>
      {noDeadline.length > 0 && <section className="calendar-unscheduled"><header><strong>Needs a deadline</strong><span>{noDeadline.length} records</span></header>{noDeadline.map((record) => <button key={record.id} onClick={() => onOpen(record)}><span>{record.title}</span><small>{record.system} · {record.status}</small></button>)}</section>}
    </section>
  </Module>;
}

function formatReviewLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDeadline(value: string) {
  const date = parseDeadline(value);
  if (Number.isNaN(date.getTime())) return "Deadline unavailable";
  return `Due ${date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · ${deadlineClass(value) === "deadline-overdue" ? "overdue" : deadlineClass(value) === "deadline-soon" ? "due soon" : "on schedule"}`;
}

function formatSubmittedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "time unavailable" : date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function deadlineClass(value: string) {
  const due = parseDeadline(value).getTime();
  const days = (due - Date.now()) / 86_400_000;
  return days < 0 ? "deadline-overdue" : days <= 3 ? "deadline-soon" : "deadline-on-track";
}

function parseDeadline(value: string) {
  const date = value.includes("T") ? new Date(value) : new Date(`${value.slice(0, 10)}T23:59:59`);
  return date;
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.length >= 16 ? value.slice(0, 16) : "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function TeamDirectory({ currentUser, users, roles, departments, positions, onUpdated }: { currentUser: AppUser; users: AppUser[]; roles: string[]; departments: string[]; positions: OrganizationPositionOption[]; onUpdated: (user: AppUser) => void }) {
  const canManage = canEditUser(currentUser);
  const roleOptions = [...roles.filter(isOfficialRole), "Member"];
  const [drafts, setDrafts] = useState<Record<string, { roles: string[]; departments: string[]; positions: string[] }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function save(user: AppUser) {
    const draft = drafts[user.id] ?? { roles: user.roles?.length ? user.roles : user.role === "member" ? ["Member"] : (isOfficialRole(user.role) ? [user.role] : []), departments: user.departments ?? [], positions: user.positions?.map((position) => position.code) ?? [] };
    const submittedRoles = draft.roles.map((role) => role === "Member" ? "member" : role);
    const accessRole = user.role === "admin" ? user.role : submittedRoles[0] ?? user.role;
    if (!draft.roles.length) { setMessage(`${user.displayName} must have at least one role.`); return; }
    setBusy(user.id); setMessage("");
    try {
      const response = await fetch("/api/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: user.id, displayName: user.displayName, email: user.email, role: accessRole, roles: submittedRoles, departments: draft.departments, positions: draft.positions }) });
      const payload = await readJson<{ user?: AppUser; roles?: string[]; departments?: string[]; error?: string }>(response);
      if (!response.ok || !payload?.user) throw new Error(payload?.error || "The team member could not be updated.");
      onUpdated({ ...user, ...payload.user, roles: payload.roles?.filter(isOfficialRole) ?? draft.roles as AppUser["roles"], departments: payload.departments ?? draft.departments });
      setMessage(`${user.displayName}'s role and position assignment was saved.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "The team member could not be updated."); }
    finally { setBusy(null); }
  }

  return <section className="team-directory"><header><div><small>REGISTERED TEAM MEMBERS</small><h2>{users.length} people in the workspace</h2><p>Assign roles, departments and organizational positions. Reporting lines are calculated automatically from the fixed hierarchy.</p></div>{!canManage && <span className="read-only-badge">Read only</span>}</header>{message && <div className="inline-message">{message}</div>}<div className="team-list">{users.map((user) => { const draft = drafts[user.id] ?? { roles: user.roles?.length ? user.roles : user.role === "member" ? ["Member"] : (isOfficialRole(user.role) ? [user.role] : []), departments: user.departments ?? [], positions: user.positions?.map((position) => position.code) ?? [] }; return <article key={user.id} className="team-member"><div className="team-member-identity"><span>{user.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{user.email}</small><em>{draft.roles.length ? draft.roles.join(" · ") : "Role assignment required"}</em></div></div><label>Working roles<select disabled={!canManage} multiple value={draft.roles} onChange={(event) => setDrafts((current) => ({ ...current, [user.id]: { ...draft, roles: Array.from(event.target.selectedOptions, (option) => option.value) } }))}>{roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}</select><small>Multiple working roles are allowed.</small></label><label>Organizational positions<select disabled={!canManage} multiple value={draft.positions} onChange={(event) => setDrafts((current) => ({ ...current, [user.id]: { ...draft, positions: Array.from(event.target.selectedOptions, (option) => option.value) } }))}>{positions.map((position) => <option key={position.code} value={position.code}>{position.name}{position.department ? ` · ${position.department}` : ""}</option>)}</select><small>Use a department-head or leader position to assign authority.</small></label><label>Departments<select disabled={!canManage} multiple value={draft.departments} onChange={(event) => setDrafts((current) => ({ ...current, [user.id]: { ...draft, departments: Array.from(event.target.selectedOptions, (option) => option.value) } }))}>{departments.map((department) => <option key={department}>{department}</option>)}</select><small>Members may belong to more than one department.</small></label><div className="computed-chain"><small>REPORTS THROUGH</small><strong>{user.managementChain?.map((item) => item.userName ? `${item.name} (${item.userName})` : item.name).join(" → ") || "No supervisor assigned yet"}</strong></div>{canManage && <button className="primary small-primary" disabled={busy === user.id} onClick={() => void save(user)}>{busy === user.id ? "Saving…" : "Save assignment"}</button>}</article>; })}{!users.length && <MiniEmpty title="No registered team members" copy="Members appear here after they sign in or are registered by the team." />}</div></section>;
}

function OrganizationSettings({ currentUser, hours, onSaved }: { currentUser: AppUser; hours: number; onSaved: (hours: number) => void }) {
  const canManage = canEditUser(currentUser);
  const [value, setValue] = useState(String(hours));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/organization", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ overdueEscalationHours: value }) });
      const payload = await readJson<{ overdueEscalationHours?: number; error?: string }>(response);
      if (!response.ok || !payload?.overdueEscalationHours) throw new Error(payload?.error || "Could not save escalation timing.");
      onSaved(payload.overdueEscalationHours); setValue(String(payload.overdueEscalationHours)); setMessage("Overdue escalation timing saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save escalation timing."); }
    finally { setBusy(false); }
  }
  return <section className="organization-setting"><div><small>GLOBAL OVERDUE ESCALATION</small><strong>Notify the next higher authority every</strong><span>hours after a review deadline passes.</span></div><div><input aria-label="Overdue escalation hours" type="number" min="1" max="8760" disabled={!canManage} value={value} onChange={(event) => setValue(event.target.value)} /><button className="secondary" disabled={!canManage || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save timing"}</button></div>{message && <p className="inline-message">{message}</p>}</section>;
}

function ProjectEditor({ project, recordCount, editable, onSave, onNewRecord }: { project: Project; recordCount: number; editable: boolean; onSave: (project: Project) => Promise<void>; onNewRecord: (type?: string) => void }) {
  const [form, setForm] = useState(project);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage("");
    try { await onSave(form); setMessage("Saved."); }
    catch (caught) { setMessage(caught instanceof Error ? caught.message : "Could not save."); }
  }
  return (
    <section className="project-layout">
      <article className="project-summary"><small>ACTIVE VEHICLE PROGRAMME</small><div className="project-mark">{project.name.slice(0, 1)}</div><h2>{project.name}</h2><p>{project.code} · {project.season}</p><dl><div><dt>Records</dt><dd>{recordCount}</dd></div><div><dt>Competition</dt><dd>{project.competition}</dd></div><div><dt>Class</dt><dd>{project.vehicleClass}</dd></div><div><dt>Status</dt><dd>{project.status}</dd></div></dl>{editable ? <button className="primary" onClick={() => onNewRecord()}>＋ Add record inside this project</button> : <span className="read-only-badge">Read only</span>}</article>
      <form className="project-form" onSubmit={submit}><fieldset disabled={!editable}><header><small>PROJECT DETAILS</small><h2>Define what the team is building</h2><p>These values appear in generated documents and give every record the correct context.</p></header>
        {message && <div className="inline-message">{message}</div>}
        <div className="form-grid"><label>Project name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Project code<input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label></div>
        <div className="form-grid"><label>Season<input value={form.season} onChange={(event) => setForm({ ...form, season: event.target.value })} /></label><label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Active</option><option>Planning</option><option>Archived</option></select></label></div>
        <label>Competition<input value={form.competition} onChange={(event) => setForm({ ...form, competition: event.target.value })} /></label>
        <label>Vehicle class and architecture<input value={form.vehicleClass} onChange={(event) => setForm({ ...form, vehicleClass: event.target.value })} /></label>
        <label>Programme objective<textarea value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} /></label>
        <label>Vehicle summary<textarea value={form.vehicleSummary} onChange={(event) => setForm({ ...form, vehicleSummary: event.target.value })} /></label>
        <footer><button className="primary">Save project details</button></footer></fieldset>
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
  return <div className="record-table">{records.map((item) => <button className="record-row" key={item.id} onClick={() => onOpen(item)}><span>▤</span><div><strong>{item.title}</strong><small>{item.id} · {item.type} · R{item.revision}{item.masterApproved ? " · ⚡ Master approved" : ""}</small></div><span className="system">{item.department || item.system}<small>{item.system} · {item.priority}{item.dueAt ? ` · ${formatDeadline(item.dueAt)}` : ""}</small></span><Status value={item.status} /><span className="updated">{item.completeness}%</span><span className="record-open">Open →</span></button>)}</div>;
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
    ["Record ID", "Project", "Title", "Type", "Department", "Sub-project", "Working role", "Owner", "Reviewer", "Status", "Priority", "Document deadline", "Revision", "Completeness", "Review rounds", "Review history", "Audit events", "Evidence files"],
    ...records.map((item) => [item.id, project.code, item.title, item.type, item.department || "Not assigned", item.system, item.submittedRole || "Not recorded", item.owner, item.reviewer, item.status, item.priority, item.dueAt || "Not assigned", String(item.revision), `${item.completeness}%`, String(item.reviewHistory?.length ?? 0), JSON.stringify((item.reviewHistory ?? []).map((review) => ({ round: review.reviewRound, reviewer: review.reviewerName, status: review.status, whatChanged: review.requestedChanges, why: review.comment, proposedTitle: review.proposedTitle, proposedSystem: review.proposedSystem, proposedProblem: review.proposedProblem, proposedDetails: parseReviewDetails(review.proposedDetailsJson), submittedAt: review.createdAt, dueAt: review.dueAt })), null, 0), String(item.eventHistory?.length ?? 0), String(item.evidenceHistory?.length ?? 0)]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${project.code}-record-register.csv`);
}
function exportWord(project: Project, records: RecordItem[], title: string) {
  const sections = records.map((record) => `
    <section class="record">
      <p class="eyebrow">${escapeHtml(record.id)} · ${escapeHtml(record.type)} · Sub-project: ${escapeHtml(record.system)}</p>
      <h1>${escapeHtml(record.title)}</h1>
      <table><tr><th>Status</th><td>${escapeHtml(record.status)}</td><th>Owner</th><td>${escapeHtml(record.owner)}</td></tr>
      <tr><th>Department</th><td>${escapeHtml(record.department || "Not assigned")}</td><th>Sub-project</th><td>${escapeHtml(record.system)}</td></tr>
      <tr><th>Working role</th><td>${escapeHtml(record.submittedRole || "Not recorded")}</td><th>Priority / revision</th><td>${escapeHtml(record.priority)} · R${record.revision}</td></tr>
      <tr><th>Deadline</th><td>${escapeHtml(record.dueAt ? formatExportDate(record.dueAt) : "Not assigned")}</td><th>Reviewer</th><td>${escapeHtml(record.reviewer)}</td></tr>
      </table>
      <h2>Problem or purpose</h2><p>${escapeHtml(record.problem || "Not completed.")}</p>
      ${(templateFields[record.type] ?? []).map((field) => `<h2>${escapeHtml(field.label)}</h2><p>${escapeHtml(record.details[field.key] || "Not completed.")}</p>`).join("")}
      ${historyHtml(record)}
      ${evidenceHtml(record)}
    </section>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{margin:22mm} body{font-family:Arial,sans-serif;color:#1c2226;font-size:10.5pt;line-height:1.5}
    .cover{padding-top:50mm;page-break-after:always}.brand,.eyebrow{color:#d71920;font-weight:bold;letter-spacing:.08em}
    h1{font-size:24pt;line-height:1.15;margin:8pt 0 12pt}h2{font-size:13pt;margin:18pt 0 5pt;border-bottom:1px solid #ddd;padding-bottom:4pt}
    .meta{color:#596269}.objective{background:#f1f3f4;padding:12pt;border-left:4px solid #d71920}
    .record{page-break-before:always}table{width:100%;border-collapse:collapse;margin:10pt 0 18pt}th,td{border:1px solid #cfd4d7;padding:6pt;text-align:left;vertical-align:top}th{background:#f2f4f5;width:18%}
    .history{page-break-before:always}.history-item{margin:12pt 0;padding:9pt;border:1px solid #cfd4d7}.history-item h3{margin:0 0 6pt;font-size:11pt}.history-item p{margin:4pt 0}.history-item pre{padding:8pt;background:#f4f5f6;white-space:pre-wrap;font-size:8pt}
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
    write(`${record.type} · Sub-project: ${record.system} · ${record.status}`, 9, true);
    write(`Department: ${record.department || "Not assigned"} | Sub-project: ${record.system} | Working role: ${record.submittedRole || "Not recorded"}`, 9);
    write(`Priority: ${record.priority} | Revision: R${record.revision} | Document deadline: ${record.dueAt ? formatExportDate(record.dueAt) : "Not assigned"}`, 9);
    write(`Owner: ${record.owner} | Reviewer: ${record.reviewer}`, 9);
    y += 3; write("Problem or purpose", 13, true, 6); write(record.problem);
    for (const field of templateFields[record.type] ?? []) {
      y += 2; write(field.label, 12, true, 6); write(record.details[field.key] || "Not completed.");
    }
    y += 4; write("Evidence register", 14, true, 6);
    if (!record.evidenceHistory?.length) write("No evidence files were attached.", 10);
    for (const item of record.evidenceHistory ?? []) {
      write(`${item.filename} · ${item.contentType} · ${formatBytes(item.size)} · Added ${item.createdAt ? formatExportDate(item.createdAt) : "date unavailable"}`, 9, true);
      write(item.caption || "No caption provided.", 9);
    }
    y += 4; write("Review and change history", 14, true, 6);
    if (!record.reviewHistory?.length) write("No review sub-records were recorded.", 10);
    for (const review of record.reviewHistory ?? []) {
      write(`Round ${review.reviewRound} · ${review.status}`, 11, true, 6);
      write(`Reviewer: ${review.reviewerName} · Submitted: ${formatExportDate(review.createdAt)}${review.dueAt ? ` · Deadline: ${formatExportDate(review.dueAt)}` : ""}`, 9);
      write(`What changed: ${review.requestedChanges || "No change summary provided."}`, 9);
      write(`Why: ${review.comment || "No reason provided."}`, 9);
      write(`Proposed title: ${review.proposedTitle || record.title}`, 9);
      write(`Proposed sub-project: ${review.proposedSystem || record.system}`, 9);
      write(`Proposed problem: ${review.proposedProblem || record.problem || "Not completed."}`, 9);
      for (const [key, value] of Object.entries(parseReviewDetails(review.proposedDetailsJson))) write(`${formatReviewLabel(key)}: ${value || "Not completed."}`, 9);
    }
    if (record.eventHistory?.length) {
      y += 4; write("Record audit trail", 12, true, 6);
      for (const event of record.eventHistory) {
        const payload = parseEventPayload(event.payloadJson);
        write(`${formatReviewLabel(event.type)} · ${formatExportDate(event.createdAt)} · ${auditActor(event, payload)}`, 9, true);
        for (const change of buildAuditChanges(event, payload)) write(`${change.label}: ${change.before !== undefined ? `${change.before} -> ` : ""}${change.after}`, 8, false, 4);
      }
    }
  }
  pdf.save(`${safeFileName(title)}.pdf`);
}

function historyHtml(record: RecordItem) {
  const reviews = record.reviewHistory ?? [];
  const events = record.eventHistory ?? [];
  const reviewMarkup = reviews.length
    ? reviews.map((review) => {
      const proposed = [
        ["Title", review.proposedTitle || record.title],
        ["Sub-project", review.proposedSystem || record.system],
        ["Problem", review.proposedProblem || record.problem || "Not completed."],
        ...Object.entries(parseReviewDetails(review.proposedDetailsJson)).map(([key, value]) => [formatReviewLabel(key), value || "Not completed."] as [string, string]),
      ];
      return `<article class="history-item"><h3>Round ${escapeHtml(String(review.reviewRound))} · ${escapeHtml(review.status)}</h3><p><b>Reviewer:</b> ${escapeHtml(review.reviewerName)} · <b>Submitted:</b> ${escapeHtml(formatExportDate(review.createdAt))}${review.dueAt ? ` · <b>Deadline:</b> ${escapeHtml(formatExportDate(review.dueAt))}` : ""}</p><p><b>What changed:</b> ${escapeHtml(review.requestedChanges || "No change summary provided.")}</p><p><b>Why:</b> ${escapeHtml(review.comment || "No reason provided.")}</p><table>${proposed.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join("")}</table></article>`;
    }).join("")
    : "<p>No review sub-records were recorded.</p>";
  const eventMarkup = events.length
    ? `<h3>Record audit trail</h3>${events.map((event) => { const payload = parseEventPayload(event.payloadJson); const changes = buildAuditChanges(event, payload); return `<article class="history-item"><h3>${escapeHtml(formatReviewLabel(event.type))}</h3><p><b>When:</b> ${escapeHtml(formatExportDate(event.createdAt))} · <b>Actor:</b> ${escapeHtml(auditActor(event, payload))}</p><table><thead><tr><th>Field</th><th>Previous value</th><th>New value</th></tr></thead><tbody>${changes.map((change) => `<tr><th>${escapeHtml(change.label)}</th><td>${escapeHtml(change.before ?? "—")}</td><td>${escapeHtml(change.after)}</td></tr>`).join("")}</tbody></table></article>`; }).join("")}`
    : "";
  return `<section class="history"><h2>Review and change history</h2><p>This section preserves the review decisions, requested changes, proposed answers and audit events for this record.</p>${reviewMarkup}${eventMarkup}</section>`;
}

function evidenceHtml(record: RecordItem) {
  const evidence = record.evidenceHistory ?? [];
  const rows = evidence.length
    ? evidence.map((item) => `<tr><th>${escapeHtml(item.filename)}</th><td>${escapeHtml(item.contentType)} · ${escapeHtml(formatBytes(item.size))}</td><td>${escapeHtml(item.caption || "No caption provided.")}</td></tr>`).join("")
    : `<tr><td colspan="3">No evidence files were attached.</td></tr>`;
  return `<section class="history evidence-export"><h2>Evidence register</h2><table><thead><tr><th>File</th><th>Format and size</th><th>What it supports</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function parseEventPayload(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

type AuditChange = { label: string; before?: string; after: string };

function buildAuditChanges(event: RecordEventItem, payload: Record<string, unknown>): AuditChange[] {
  const source = isObject(payload.changes) ? payload.changes : payload;
  const before = isObject(payload.before) ? payload.before : null;
  const after = isObject(payload.after) ? payload.after : null;
  const keys = [...new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
    ...Object.keys(source),
  ])].filter((key) => !["actorName", "actorUserId", "reviewId", "id", "projectId", "createdAt", "updatedAt", "before", "after", "changes"].includes(key));
  const entries: AuditChange[] = [];
  for (const key of keys) {
    const hasBeforeValue = Boolean(before && Object.prototype.hasOwnProperty.call(before, key));
    const hasAfterValue = Boolean(after && Object.prototype.hasOwnProperty.call(after, key));
    const oldValue = before?.[key];
    const newValue = hasAfterValue ? after?.[key] : source[key];
    if (before && after && hasBeforeValue && hasAfterValue && JSON.stringify(oldValue) === JSON.stringify(newValue)) continue;
    if (newValue === undefined && !hasBeforeValue) continue;
    if (key === "details" || key === "detailsJson") {
      const oldDetails = auditObject(oldValue);
      const newDetails = auditObject(newValue);
      if (oldDetails || newDetails) {
        const detailKeys = [...new Set([...Object.keys(oldDetails ?? {}), ...Object.keys(newDetails ?? {})])];
        for (const detailKey of detailKeys) {
          const hasOldDetail = Object.prototype.hasOwnProperty.call(oldDetails ?? {}, detailKey);
          const hasNewDetail = Object.prototype.hasOwnProperty.call(newDetails ?? {}, detailKey);
          const oldDetail = oldDetails?.[detailKey];
          const newDetail = newDetails?.[detailKey];
          if (hasOldDetail && hasNewDetail && JSON.stringify(oldDetail) === JSON.stringify(newDetail)) continue;
          if (!hasNewDetail && !hasOldDetail) continue;
          entries.push({
            label: `Guided answers · ${formatReviewLabel(detailKey)}`,
            ...(hasOldDetail ? { before: auditFieldValue(detailKey, oldDetail) } : {}),
            after: auditFieldValue(detailKey, newDetail),
          });
        }
        continue;
      }
    }
    entries.push({
      label: auditFieldLabel(key),
      ...(hasBeforeValue ? { before: auditFieldValue(key, oldValue) } : {}),
      after: auditFieldValue(key, newValue),
    });
  }
  if (entries.length) return entries;
  return [{ label: "Event", after: formatReviewLabel(event.type) }];
}

function auditActor(event: RecordEventItem, payload: Record<string, unknown>) {
  return String(payload.actorName ?? event.actorUserId ?? "Previous system event");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function auditObject(value: unknown): Record<string, unknown> | null {
  if (isObject(value)) return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return isObject(parsed) ? parsed : null;
  } catch { return null; }
}

function auditFieldLabel(value: string) {
  const labels: Record<string, string> = {
    details: "Guided answers",
    detailsJson: "Guided answers",
    reviewerUserId: "Reviewer",
    reviewerUserIds: "Reviewers",
    submittedRole: "Working role",
    reviewDueAt: "Review deadline",
    reviewRound: "Review round",
    reviewStatus: "Review decision",
    recordStatus: "Record status",
    requestedChanges: "Changes requested",
    comment: "Reviewer comment",
    proposedTitle: "Proposed title",
    proposedSystem: "Proposed sub-project",
    proposedProblem: "Proposed problem",
  };
  return labels[value] ?? formatReviewLabel(value);
}

function auditFieldValue(key: string, value: unknown) {
  if (value === undefined || value === null || value === "") return "Empty";
  if (Array.isArray(value)) return value.join(", ") || "Empty";
  if (typeof value === "object") return "Updated structured data";
  const text = String(value);
  return text.length > 420 ? `${text.slice(0, 417)}…` : text;
}

function formatExportDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
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
