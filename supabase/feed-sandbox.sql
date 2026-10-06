-- Applied only to academy_sandbox; production activation requires explicit approval.
ALTER TABLE academy_sandbox.media_files DROP CONSTRAINT media_files_scope_check;
ALTER TABLE academy_sandbox.media_files ADD CONSTRAINT media_files_scope_check CHECK (scope IN ('chat','verification','background','feed'));
