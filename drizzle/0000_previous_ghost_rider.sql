CREATE TABLE `engineering_records` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`system` text NOT NULL,
	`owner` text NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`problem` text DEFAULT '' NOT NULL,
	`completeness` integer DEFAULT 28 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
