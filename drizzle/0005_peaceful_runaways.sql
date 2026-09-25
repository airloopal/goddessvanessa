CREATE TABLE `education_enrolments` (
	`user_id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`name` text NOT NULL,
	`path_id` text NOT NULL,
	`answers` text DEFAULT '{}' NOT NULL,
	`snapshot` text NOT NULL,
	`completed` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
