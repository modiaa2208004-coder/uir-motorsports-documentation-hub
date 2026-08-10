CREATE TABLE `reporting_relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`reports_to_user_id` text,
	`leader_user_id` text,
	`level` text DEFAULT 'Team Member' NOT NULL,
	`permissions_json` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reporting_relationships_user_unique` ON `reporting_relationships` (`user_id`);--> statement-breakpoint
CREATE INDEX `reporting_relationships_reports_to_idx` ON `reporting_relationships` (`reports_to_user_id`);--> statement-breakpoint
CREATE INDEX `reporting_relationships_leader_idx` ON `reporting_relationships` (`leader_user_id`);