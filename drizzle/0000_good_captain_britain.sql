CREATE TABLE `member_progress` (
	`user_id` text PRIMARY KEY NOT NULL,
	`level` text DEFAULT 'Beginner' NOT NULL,
	`step` integer DEFAULT 0 NOT NULL,
	`checks` text DEFAULT '{}' NOT NULL,
	`completed` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
