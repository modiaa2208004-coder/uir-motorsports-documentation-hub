CREATE TABLE `organizational_positions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`position_type` text DEFAULT 'member' NOT NULL,
	`department` text,
	`branch` text DEFAULT 'competition' NOT NULL,
	`parent_position_code` text,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizational_positions_code_unique` ON `organizational_positions` (`code`);--> statement-breakpoint
CREATE INDEX `organizational_positions_parent_idx` ON `organizational_positions` (`parent_position_code`);--> statement-breakpoint
CREATE INDEX `organizational_positions_department_idx` ON `organizational_positions` (`department`);--> statement-breakpoint
CREATE TABLE `user_positions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`position_id` text NOT NULL,
	`department` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `user_positions_user_idx` ON `user_positions` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_positions_position_idx` ON `user_positions` (`position_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_positions_unique` ON `user_positions` (`user_id`,`position_id`,`department`);--> statement-breakpoint
CREATE TABLE `workflow_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`setting_key` text NOT NULL,
	`setting_value` text NOT NULL,
	`updated_by_user_id` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workflow_settings_key_unique` ON `workflow_settings` (`setting_key`);--> statement-breakpoint
DROP TABLE `reporting_relationships`;--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `overdue_at` text;--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `approval_chain_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `master_approved` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `master_approved_by_user_id` text;--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `master_approval_reason` text;--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `master_approval_comment` text;--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `master_approval_at` text;