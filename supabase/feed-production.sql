-- Authorized Live publication. One atomic constraint change with a bounded lock wait.
-- No records, RLS, grants, storage ownership or quotas are changed.
DO $migration$
BEGIN
 PERFORM set_config('lock_timeout','5s',true);
 EXECUTE 'ALTER TABLE academy.media_files DROP CONSTRAINT media_files_scope_check, ADD CONSTRAINT media_files_scope_check CHECK (scope IN (''chat'',''verification'',''background'',''feed''))';
END
$migration$;
