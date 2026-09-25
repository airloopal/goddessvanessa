CREATE TABLE `chat_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`student_id` text NOT NULL,
	`sender` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `chat_students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_messages_id_unique` ON `chat_messages` (`id`);--> statement-breakpoint
CREATE INDEX `idx_chat_messages_student_seq` ON `chat_messages` (`student_id`,`seq`);--> statement-breakpoint
CREATE TABLE `chat_sessions` (
	`hash` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `chat_students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_student` ON `chat_sessions` (`student_id`);--> statement-breakpoint
CREATE TABLE `chat_state` (
	`student_id` text NOT NULL,
	`role` text NOT NULL,
	`typing_until` integer DEFAULT 0 NOT NULL,
	`read_seq` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `chat_students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_chat_state_student_role` ON `chat_state` (`student_id`,`role`);--> statement-breakpoint
CREATE TABLE `chat_students` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`code_hash` text,
	`code_expires` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_students_user_id_unique` ON `chat_students` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `chat_students_code_hash_unique` ON `chat_students` (`code_hash`);