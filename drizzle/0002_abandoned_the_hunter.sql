CREATE TABLE `project_members` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `project_members_project_idx` ON `project_members` (`project_id`);--> statement-breakpoint
CREATE INDEX `project_members_user_idx` ON `project_members` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_members_project_user_unique` ON `project_members` (`project_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `record_events` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`project_id` text NOT NULL,
	`actor_user_id` text,
	`type` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `record_events_record_idx` ON `record_events` (`record_id`);--> statement-breakpoint
CREATE INDEX `record_events_project_idx` ON `record_events` (`project_id`);--> statement-breakpoint
CREATE INDEX `record_events_created_idx` ON `record_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
ALTER TABLE `record_evidence` ADD `project_id` text DEFAULT 'HOPE-2027' NOT NULL;--> statement-breakpoint
ALTER TABLE `record_evidence` ADD `uploaded_by_user_id` text;--> statement-breakpoint
ALTER TABLE `record_evidence` ADD `sha256` text;--> statement-breakpoint
ALTER TABLE `record_evidence` ADD `deleted_at` text;--> statement-breakpoint
CREATE INDEX `record_evidence_record_idx` ON `record_evidence` (`record_id`);--> statement-breakpoint
CREATE INDEX `record_evidence_project_idx` ON `record_evidence` (`project_id`);--> statement-breakpoint
CREATE INDEX `record_evidence_created_idx` ON `record_evidence` (`created_at`);--> statement-breakpoint
CREATE INDEX `record_evidence_deleted_idx` ON `record_evidence` (`deleted_at`);--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `owner_user_id` text;--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `reviewer_user_id` text;--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `review_feedback` text;--> statement-breakpoint
CREATE INDEX `engineering_records_project_idx` ON `engineering_records` (`project_id`);--> statement-breakpoint
CREATE INDEX `engineering_records_updated_idx` ON `engineering_records` (`updated_at`);--> statement-breakpoint
CREATE INDEX `engineering_records_status_idx` ON `engineering_records` (`status`);