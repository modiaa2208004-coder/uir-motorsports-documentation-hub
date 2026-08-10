ALTER TABLE `record_reviews` ADD `review_round` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `record_reviews` ADD `due_at` text;--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `review_round` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `engineering_records` ADD `review_due_at` text;