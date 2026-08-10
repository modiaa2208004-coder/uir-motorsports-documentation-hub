CREATE TABLE `approval_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`document_type` text DEFAULT '*' NOT NULL,
	`department` text DEFAULT '*' NOT NULL,
	`required_role` text DEFAULT 'Team Leader' NOT NULL,
	`approval_depth` integer DEFAULT 1 NOT NULL,
	`parallel` integer DEFAULT 1 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_by_user_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `approval_rules_active_idx` ON `approval_rules` (`active`);--> statement-breakpoint
CREATE TABLE `approval_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`reviewer_user_id` text NOT NULL,
	`step_order` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`decided_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `approval_steps_workflow_idx` ON `approval_steps` (`workflow_id`);--> statement-breakpoint
CREATE INDEX `approval_steps_reviewer_idx` ON `approval_steps` (`reviewer_user_id`);--> statement-breakpoint
CREATE TABLE `approval_workflows` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`required_approvals` integer DEFAULT 1 NOT NULL,
	`completed_approvals` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'Open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `approval_workflows_record_unique` ON `approval_workflows` (`record_id`);--> statement-breakpoint
CREATE TABLE `components` (
	`id` text PRIMARY KEY NOT NULL,
	`subproject_id` text NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`owner_user_id` text,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `components_subproject_idx` ON `components` (`subproject_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `components_subproject_code_unique` ON `components` (`subproject_id`,`code`);--> statement-breakpoint
CREATE TABLE `departments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent_department_id` text,
	`parent_role` text,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `departments_name_unique` ON `departments` (`name`);--> statement-breakpoint
CREATE INDEX `departments_parent_idx` ON `departments` (`parent_department_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`record_id` text,
	`task_id` text,
	`request_id` text,
	`read_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `notifications_created_idx` ON `notifications` (`created_at`);--> statement-breakpoint
CREATE INDEX `notifications_unread_idx` ON `notifications` (`user_id`,`read_at`);--> statement-breakpoint
CREATE TABLE `record_relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`source_record_id` text NOT NULL,
	`target_record_id` text NOT NULL,
	`relationship_type` text NOT NULL,
	`created_by_user_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `record_relationships_source_idx` ON `record_relationships` (`source_record_id`);--> statement-breakpoint
CREATE INDEX `record_relationships_target_idx` ON `record_relationships` (`target_record_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `record_relationships_unique` ON `record_relationships` (`source_record_id`,`target_record_id`,`relationship_type`);--> statement-breakpoint
CREATE TABLE `record_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`project_id` text NOT NULL,
	`revision` integer NOT NULL,
	`status` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`change_summary` text DEFAULT '' NOT NULL,
	`created_by_user_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `record_versions_record_idx` ON `record_versions` (`record_id`);--> statement-breakpoint
CREATE INDEX `record_versions_project_idx` ON `record_versions` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `record_versions_record_revision_unique` ON `record_versions` (`record_id`,`revision`);--> statement-breakpoint
CREATE TABLE `subprojects` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`department_id` text,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`objective` text DEFAULT '' NOT NULL,
	`lead_user_id` text,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `subprojects_project_idx` ON `subprojects` (`project_id`);--> statement-breakpoint
CREATE INDEX `subprojects_department_idx` ON `subprojects` (`department_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `subprojects_project_code_unique` ON `subprojects` (`project_id`,`code`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`contact_name` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `suppliers_name_idx` ON `suppliers` (`name`);--> statement-breakpoint
CREATE TABLE `task_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`author_user_id` text,
	`comment` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `task_comments_task_idx` ON `task_comments` (`task_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`record_id` text,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`department` text DEFAULT '' NOT NULL,
	`assigned_to_user_id` text,
	`assigned_by_user_id` text,
	`priority` text DEFAULT 'Normal' NOT NULL,
	`due_at` text,
	`status` text DEFAULT 'To do' NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tasks_project_idx` ON `tasks` (`project_id`);--> statement-breakpoint
CREATE INDEX `tasks_record_idx` ON `tasks` (`record_id`);--> statement-breakpoint
CREATE INDEX `tasks_assignee_idx` ON `tasks` (`assigned_to_user_id`);--> statement-breakpoint
CREATE INDEX `tasks_due_at_idx` ON `tasks` (`due_at`);--> statement-breakpoint
CREATE TABLE `work_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`record_id` text,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`department` text DEFAULT '' NOT NULL,
	`requested_by_user_id` text,
	`assigned_to_user_id` text,
	`priority` text DEFAULT 'Normal' NOT NULL,
	`due_at` text,
	`status` text DEFAULT 'Draft' NOT NULL,
	`details_json` text DEFAULT '{}' NOT NULL,
	`approval_chain_json` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `work_requests_project_idx` ON `work_requests` (`project_id`);--> statement-breakpoint
CREATE INDEX `work_requests_record_idx` ON `work_requests` (`record_id`);--> statement-breakpoint
CREATE INDEX `work_requests_requester_idx` ON `work_requests` (`requested_by_user_id`);--> statement-breakpoint
CREATE INDEX `work_requests_status_idx` ON `work_requests` (`status`);--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `department` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `subproject_id` text;--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `component_id` text;--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `priority` text DEFAULT 'Normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `due_at` text;--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `responsible_user_ids` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `supervisor_user_id` text;--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `approver_user_ids` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `competition_related` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `engineering_records_department_idx` ON `engineering_records` (`department`);--> statement-breakpoint
CREATE INDEX `engineering_records_subproject_idx` ON `engineering_records` (`subproject_id`);--> statement-breakpoint
CREATE INDEX `engineering_records_due_at_idx` ON `engineering_records` (`due_at`);