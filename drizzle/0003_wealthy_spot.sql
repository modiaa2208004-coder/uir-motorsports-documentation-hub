CREATE TABLE `record_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`project_id` text NOT NULL,
	`reviewer_user_id` text NOT NULL,
	`reviewer_name` text NOT NULL,
	`requested_changes` text DEFAULT '' NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `record_reviews_record_idx` ON `record_reviews` (`record_id`);--> statement-breakpoint
CREATE INDEX `record_reviews_reviewer_idx` ON `record_reviews` (`reviewer_user_id`);