-- Prepared only: do not execute until net and vault are confirmed absent from
-- Supabase's exposed Data API schemas and database login roles are trusted.
-- This installs a DISABLED Sandbox-only scheduler. No secrets are embedded.
-- pg_net queue headers are visible to database login roles: Supabase does not
-- support revoking its managed PUBLIC grants. Vault does not hide queued headers.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='vanessa-sandbox-email-reminders') THEN
  RAISE EXCEPTION 'Sandbox reminder job already exists; inspect it before changing it';
 END IF;
END $$;
SELECT cron.schedule(
 'vanessa-sandbox-email-reminders',
 '* * * * *',
 $job$
 SELECT net.http_get(
  url := 'https://goddessvanessa-git-square-sandbox-system-admin.vercel.app/api/cron/notifications',
  headers := jsonb_build_object('Authorization','Bearer ' || decrypted_secret),
  timeout_milliseconds := 25000
 )
 FROM vault.decrypted_secrets
 WHERE name='vanessa_sandbox_notifications_cron_secret'
 AND length(decrypted_secret)>=32
 AND (SELECT count(*) FROM vault.decrypted_secrets
      WHERE name='vanessa_sandbox_notifications_cron_secret')=1;
 $job$
);
SELECT cron.alter_job(jobid,active := false)
FROM cron.job WHERE jobname='vanessa-sandbox-email-reminders';
COMMIT;
-- Verification outputs no command text or secret values.
SELECT jobname,schedule,active FROM cron.job
WHERE jobname='vanessa-sandbox-email-reminders';
