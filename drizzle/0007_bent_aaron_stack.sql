ALTER TABLE `engineering_records` ADD `reviewer_user_ids` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `review_submitted_at` text;