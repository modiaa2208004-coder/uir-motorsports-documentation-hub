import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  season: text("season").notNull(),
  competition: text("competition").notNull().default("Formula Student UK"),
  vehicleClass: text("vehicle_class").notNull().default("FS Class"),
  objective: text("objective").notNull().default(""),
  vehicleSummary: text("vehicle_summary").notNull().default(""),
  status: text("status").notNull().default("Active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type UserRole =
  | "Team Leader"
  | "Deputy Team Leader"
  | "Operations Leader"
  | "Competition Leader"
  | "Static Events Leader"
  | "Technical & Dynamic Leader"
  | "Marketing & Media"
  | "Finance"
  | "Logistics & Procurement"
  | "Business Plan"
  | "Cost & Manufacturing"
  | "Vehicle Mechanics"
  | "Chassis & Structures"
  | "Powertrain"
  | "Electronics & Low Voltage"
  | "Simulation, Validation & Testing"
  | "admin"
  | "reviewer"
  | "member";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(), // Entra object id (oid)
    displayName: text("display_name").notNull().default(""),
    email: text("email").notNull().default(""),
    role: text("role").notNull().default("member").$type<UserRole>(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
  }),
);

export const userRoles = sqliteTable(
  "user_roles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    role: text("role").notNull().$type<UserRole>(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userIdx: index("user_roles_user_idx").on(table.userId),
    uniqueUserRole: uniqueIndex("user_roles_user_role_unique").on(table.userId, table.role),
  }),
);

export type ProjectMemberRole = "owner" | "editor" | "viewer" | "reviewer";

export const projectMembers = sqliteTable(
  "project_members",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").notNull().default("viewer").$type<ProjectMemberRole>(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    projectIdx: index("project_members_project_idx").on(table.projectId),
    userIdx: index("project_members_user_idx").on(table.userId),
    uniqueMember: uniqueIndex("project_members_project_user_unique").on(table.projectId, table.userId),
  }),
);

export const userDepartments = sqliteTable(
  "user_departments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    department: text("department").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({ userIdx: index("user_departments_user_idx").on(table.userId), uniqueMembership: uniqueIndex("user_departments_user_department_unique").on(table.userId, table.department) }),
);

/**
 * The organization is data, not a hard-coded permission switch.  Leaders can
 * therefore be reassigned without changing application code, while the
 * department names still match the team's agreed structure.
 */
export const departments = sqliteTable(
  "departments",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    parentDepartmentId: text("parent_department_id"),
    parentRole: text("parent_role"),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("Active"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    nameIdx: uniqueIndex("departments_name_unique").on(table.name),
    parentIdx: index("departments_parent_idx").on(table.parentDepartmentId),
  }),
);

export type OrganizationalPositionType = "leader" | "department_head" | "member";

export const organizationalPositions = sqliteTable(
  "organizational_positions",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    positionType: text("position_type").notNull().default("member").$type<OrganizationalPositionType>(),
    department: text("department"),
    branch: text("branch").notNull().default("competition"),
    parentPositionCode: text("parent_position_code"),
    active: integer("active").notNull().default(1),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({ codeUnique: uniqueIndex("organizational_positions_code_unique").on(table.code), parentIdx: index("organizational_positions_parent_idx").on(table.parentPositionCode), departmentIdx: index("organizational_positions_department_idx").on(table.department) }),
);

export const userPositions = sqliteTable(
  "user_positions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    positionId: text("position_id").notNull(),
    department: text("department"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({ userIdx: index("user_positions_user_idx").on(table.userId), positionIdx: index("user_positions_position_idx").on(table.positionId), uniqueAssignment: uniqueIndex("user_positions_unique").on(table.userId, table.positionId, table.department) }),
);

export const workflowSettings = sqliteTable(
  "workflow_settings",
  {
    id: text("id").primaryKey(),
    settingKey: text("setting_key").notNull(),
    settingValue: text("setting_value").notNull(),
    updatedByUserId: text("updated_by_user_id"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({ keyUnique: uniqueIndex("workflow_settings_key_unique").on(table.settingKey) }),
);

export const subprojects = sqliteTable(
  "subprojects",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    departmentId: text("department_id"),
    name: text("name").notNull(),
    code: text("code").notNull(),
    objective: text("objective").notNull().default(""),
    leadUserId: text("lead_user_id"),
    status: text("status").notNull().default("Active"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    projectIdx: index("subprojects_project_idx").on(table.projectId),
    departmentIdx: index("subprojects_department_idx").on(table.departmentId),
    projectCodeUnique: uniqueIndex("subprojects_project_code_unique").on(table.projectId, table.code),
  }),
);

export const components = sqliteTable(
  "components",
  {
    id: text("id").primaryKey(),
    subprojectId: text("subproject_id").notNull(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    description: text("description").notNull().default(""),
    ownerUserId: text("owner_user_id"),
    status: text("status").notNull().default("Active"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    subprojectIdx: index("components_subproject_idx").on(table.subprojectId),
    subprojectCodeUnique: uniqueIndex("components_subproject_code_unique").on(table.subprojectId, table.code),
  }),
);

export type RecordStatus = "Draft" | "Submitted" | "In review" | "Returned" | "Approved" | "Rejected" | "Closed" | "Archived" | "Cancelled" | "Overdue";
export type RecordPriority = "Low" | "Normal" | "High" | "Critical";

export const records = sqliteTable(
  "engineering_records",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().default("HOPE-2027"),
    title: text("title").notNull(),
    type: text("type").notNull(),
    system: text("system").notNull(),
    owner: text("owner").notNull(),
    ownerUserId: text("owner_user_id"),
    submittedRole: text("submitted_role").notNull().default(""),
    department: text("department").notNull().default(""),
    subprojectId: text("subproject_id"),
    componentId: text("component_id"),
    description: text("description").notNull().default(""),
    priority: text("priority").notNull().default("Normal").$type<RecordPriority>(),
    dueAt: text("due_at"),
    responsibleUserIds: text("responsible_user_ids").notNull().default("[]"),
    supervisorUserId: text("supervisor_user_id"),
    approverUserIds: text("approver_user_ids").notNull().default("[]"),
    competitionRelated: integer("competition_related").notNull().default(0),
    revision: integer("revision").notNull().default(1),
    reviewer: text("reviewer").notNull().default("Department Leader"),
    reviewerUserId: text("reviewer_user_id"),
    reviewerUserIds: text("reviewer_user_ids").notNull().default("[]"),
    status: text("status").notNull().default("Draft").$type<RecordStatus>(),
    reviewRound: integer("review_round").notNull().default(0),
    reviewDueAt: text("review_due_at"),
    reviewSubmittedAt: text("review_submitted_at"),
    overdueAt: text("overdue_at"),
    approvalChainJson: text("approval_chain_json").notNull().default("[]"),
    masterApproved: integer("master_approved").notNull().default(0),
    masterApprovedByUserId: text("master_approved_by_user_id"),
    masterApprovalReason: text("master_approval_reason"),
    masterApprovalComment: text("master_approval_comment"),
    masterApprovalAt: text("master_approval_at"),
    problem: text("problem").notNull().default(""),
    detailsJson: text("details_json").notNull().default("{}"),
    completeness: integer("completeness").notNull().default(28),
    reviewFeedback: text("review_feedback"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    projectIdx: index("engineering_records_project_idx").on(table.projectId),
    updatedIdx: index("engineering_records_updated_idx").on(table.updatedAt),
    statusIdx: index("engineering_records_status_idx").on(table.status),
    departmentIdx: index("engineering_records_department_idx").on(table.department),
    subprojectIdx: index("engineering_records_subproject_idx").on(table.subprojectId),
    dueAtIdx: index("engineering_records_due_at_idx").on(table.dueAt),
  }),
);

export const recordVersions = sqliteTable(
  "record_versions",
  {
    id: text("id").primaryKey(),
    recordId: text("record_id").notNull(),
    projectId: text("project_id").notNull(),
    revision: integer("revision").notNull(),
    status: text("status").notNull(),
    snapshotJson: text("snapshot_json").notNull(),
    changeSummary: text("change_summary").notNull().default(""),
    createdByUserId: text("created_by_user_id"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    recordIdx: index("record_versions_record_idx").on(table.recordId),
    projectIdx: index("record_versions_project_idx").on(table.projectId),
    revisionUnique: uniqueIndex("record_versions_record_revision_unique").on(table.recordId, table.revision),
  }),
);

export type RelationshipType = "Depends on" | "Supersedes" | "Related to" | "Evidence for";

export const recordRelationships = sqliteTable(
  "record_relationships",
  {
    id: text("id").primaryKey(),
    sourceRecordId: text("source_record_id").notNull(),
    targetRecordId: text("target_record_id").notNull(),
    relationshipType: text("relationship_type").notNull().$type<RelationshipType>(),
    createdByUserId: text("created_by_user_id"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    sourceIdx: index("record_relationships_source_idx").on(table.sourceRecordId),
    targetIdx: index("record_relationships_target_idx").on(table.targetRecordId),
    uniqueRelationship: uniqueIndex("record_relationships_unique").on(table.sourceRecordId, table.targetRecordId, table.relationshipType),
  }),
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    recordId: text("record_id"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    department: text("department").notNull().default(""),
    assignedToUserId: text("assigned_to_user_id"),
    assignedByUserId: text("assigned_by_user_id"),
    priority: text("priority").notNull().default("Normal").$type<RecordPriority>(),
    dueAt: text("due_at"),
    status: text("status").notNull().default("To do"),
    completedAt: text("completed_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    projectIdx: index("tasks_project_idx").on(table.projectId),
    recordIdx: index("tasks_record_idx").on(table.recordId),
    assigneeIdx: index("tasks_assignee_idx").on(table.assignedToUserId),
    dueAtIdx: index("tasks_due_at_idx").on(table.dueAt),
  }),
);

export const taskComments = sqliteTable(
  "task_comments",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").notNull(),
    authorUserId: text("author_user_id"),
    comment: text("comment").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({ taskIdx: index("task_comments_task_idx").on(table.taskId) }),
);

export const approvalRules = sqliteTable(
  "approval_rules",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    documentType: text("document_type").notNull().default("*"),
    department: text("department").notNull().default("*"),
    requiredRole: text("required_role").notNull().default("Team Leader"),
    approvalDepth: integer("approval_depth").notNull().default(1),
    parallel: integer("parallel").notNull().default(1),
    active: integer("active").notNull().default(1),
    createdByUserId: text("created_by_user_id"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({ activeIdx: index("approval_rules_active_idx").on(table.active) }),
);

export const approvalWorkflows = sqliteTable(
  "approval_workflows",
  {
    id: text("id").primaryKey(),
    recordId: text("record_id").notNull(),
    requiredApprovals: integer("required_approvals").notNull().default(1),
    completedApprovals: integer("completed_approvals").notNull().default(0),
    status: text("status").notNull().default("Open"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({ recordIdx: uniqueIndex("approval_workflows_record_unique").on(table.recordId) }),
);

export const approvalSteps = sqliteTable(
  "approval_steps",
  {
    id: text("id").primaryKey(),
    workflowId: text("workflow_id").notNull(),
    reviewerUserId: text("reviewer_user_id").notNull(),
    stepOrder: integer("step_order").notNull().default(1),
    status: text("status").notNull().default("Pending"),
    comment: text("comment").notNull().default(""),
    decidedAt: text("decided_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({ workflowIdx: index("approval_steps_workflow_idx").on(table.workflowId), reviewerIdx: index("approval_steps_reviewer_idx").on(table.reviewerUserId) }),
);

export type RequestType = "Manufacturing" | "Purchase";

export const workRequests = sqliteTable(
  "work_requests",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    recordId: text("record_id"),
    type: text("type").notNull().$type<RequestType>(),
    title: text("title").notNull(),
    department: text("department").notNull().default(""),
    requestedByUserId: text("requested_by_user_id"),
    assignedToUserId: text("assigned_to_user_id"),
    priority: text("priority").notNull().default("Normal").$type<RecordPriority>(),
    dueAt: text("due_at"),
    status: text("status").notNull().default("Draft"),
    detailsJson: text("details_json").notNull().default("{}"),
    approvalChainJson: text("approval_chain_json").notNull().default("[]"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    projectIdx: index("work_requests_project_idx").on(table.projectId),
    recordIdx: index("work_requests_record_idx").on(table.recordId),
    requesterIdx: index("work_requests_requester_idx").on(table.requestedByUserId),
    statusIdx: index("work_requests_status_idx").on(table.status),
  }),
);

export const suppliers = sqliteTable(
  "suppliers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    contactName: text("contact_name").notNull().default(""),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({ nameIdx: index("suppliers_name_idx").on(table.name) }),
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    recordId: text("record_id"),
    taskId: text("task_id"),
    requestId: text("request_id"),
    readAt: text("read_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({ userIdx: index("notifications_user_idx").on(table.userId), createdIdx: index("notifications_created_idx").on(table.createdAt), unreadIdx: index("notifications_unread_idx").on(table.userId, table.readAt) }),
);

export type RecordEventType =
  | "record_created"
  | "record_updated"
  | "record_status_changed"
  | "review_submitted"
  | "review_assigned"
  | "record_overdue"
  | "master_approval"
  | "evidence_added"
  | "evidence_deleted";

export const recordEvents = sqliteTable(
  "record_events",
  {
    id: text("id").primaryKey(),
    recordId: text("record_id").notNull(),
    projectId: text("project_id").notNull(),
    actorUserId: text("actor_user_id"),
    type: text("type").notNull().$type<RecordEventType>(),
    payloadJson: text("payload_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    recordIdx: index("record_events_record_idx").on(table.recordId),
    projectIdx: index("record_events_project_idx").on(table.projectId),
    createdIdx: index("record_events_created_idx").on(table.createdAt),
  }),
);

export const evidence = sqliteTable(
  "record_evidence",
  {
    id: text("id").primaryKey(),
    recordId: text("record_id").notNull(),
    projectId: text("project_id").notNull().default("HOPE-2027"),
    filename: text("filename").notNull(),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull().default("application/octet-stream"),
    size: integer("size").notNull().default(0),
    caption: text("caption").notNull().default(""),
    uploadedByUserId: text("uploaded_by_user_id"),
    sha256: text("sha256"),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    recordIdx: index("record_evidence_record_idx").on(table.recordId),
    projectIdx: index("record_evidence_project_idx").on(table.projectId),
    createdIdx: index("record_evidence_created_idx").on(table.createdAt),
    deletedIdx: index("record_evidence_deleted_idx").on(table.deletedAt),
  }),
);

export type ReviewStatus = "Open" | "Changes requested" | "Accepted" | "Rejected";

export const recordReviews = sqliteTable(
  "record_reviews",
  {
    id: text("id").primaryKey(),
    recordId: text("record_id").notNull(),
    projectId: text("project_id").notNull(),
    reviewerUserId: text("reviewer_user_id").notNull(),
    reviewerName: text("reviewer_name").notNull(),
    requestedChanges: text("requested_changes").notNull().default(""),
    comment: text("comment").notNull().default(""),
    proposedTitle: text("proposed_title"),
    proposedSystem: text("proposed_system"),
    proposedProblem: text("proposed_problem"),
    proposedDetailsJson: text("proposed_details_json"),
    status: text("status").notNull().default("Open").$type<ReviewStatus>(),
    reviewRound: integer("review_round").notNull().default(1),
    dueAt: text("due_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({ recordIdx: index("record_reviews_record_idx").on(table.recordId), reviewerIdx: index("record_reviews_reviewer_idx").on(table.reviewerUserId) }),
);
