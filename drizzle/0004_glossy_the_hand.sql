CREATE TABLE `user_departments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`department` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `user_departments_user_idx` ON `user_departments` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_departments_user_department_unique` ON `user_departments` (`user_id`,`department`);