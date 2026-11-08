CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#cbd5e1' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `daily_items` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`date` text NOT NULL,
	`type` text DEFAULT 'task' NOT NULL,
	`title` text NOT NULL,
	`is_completed` integer DEFAULT 0 NOT NULL,
	`category_id` text DEFAULT 'uncategorized',
	`estimated_sessions` integer DEFAULT 4 NOT NULL,
	`completed_sessions` integer DEFAULT 0 NOT NULL,
	`logged_seconds` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
