CREATE TABLE `preview_acknowledgements` (
	`user_id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`typed_name` text NOT NULL,
	`terms_version` text NOT NULL,
	`terms_snapshot` text NOT NULL,
	`terms_hash` text NOT NULL,
	`signed_at` text NOT NULL
);
