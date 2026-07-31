CREATE TABLE `record_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`filename` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text DEFAULT 'application/octet-stream' NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`season` text NOT NULL,
	`competition` text DEFAULT 'Formula Student UK' NOT NULL,
	`vehicle_class` text DEFAULT 'FS Class' NOT NULL,
	`objective` text DEFAULT '' NOT NULL,
	`vehicle_summary` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `project_id` text DEFAULT 'HOPE-2027' NOT NULL;--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `reviewer` text DEFAULT 'Department Leader' NOT NULL;--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `details_json` text DEFAULT '{}' NOT NULL;