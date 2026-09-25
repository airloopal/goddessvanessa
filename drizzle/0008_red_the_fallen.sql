CREATE TABLE `media_files` (
	`id` text PRIMARY KEY NOT NULL,
	`storage_key` text NOT NULL,
	`student_id` text,
	`user_id` text NOT NULL,
	`scope` text NOT NULL,
	`role` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `chat_students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_media_files_student` ON `media_files` (`student_id`);--> statement-breakpoint
CREATE INDEX `idx_media_files_user_scope` ON `media_files` (`user_id`,`scope`);--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `attachment_id` text;