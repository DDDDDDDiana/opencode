CREATE TABLE `usage` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`tokens` integer NOT NULL,
	`date` text NOT NULL,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `user` ADD `name` text NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `quota_agent_calls` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `quota_concurrent_sessions` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `quota_daily_tokens` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `model_allowlist` text;--> statement-breakpoint
CREATE INDEX `usage_user_idx` ON `usage` (`user_id`);--> statement-breakpoint
CREATE INDEX `usage_date_idx` ON `usage` (`date`);