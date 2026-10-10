# Supabase scheduling — Sandbox preparation

Selected by the user on 10 October 2026. Resend setup is underway separately.

Status: shared extensions and disabled Sandbox job installed with explicit approval.
A dedicated secret is stored in Vault and branch-scoped sensitive Vercel settings.
Domain DNS records are verified. Controlled activation passed; no Live deployment.

## Preflight evidence

- Vault 0.3.1, pg_cron 1.6.4 and pg_net 0.20.4 installed after explicit approval.
- Database login roles are the existing Supabase/platform roles; no custom login roles found.
- Supabase's current documentation confirms the managed pg_net grants cannot be
  revoked. Any database login role can read queued HTTP credentials. Normal browser
  anon/authenticated roles cannot connect directly; net is not exposed by default.
- Signed-in Data API settings confirmed only public and graphql_public exposed.
  Application schemas, net and vault remain excluded. No custom login roles found.

Official security references:
- https://supabase.com/docs/guides/troubleshooting/revoking-access-to-pg_net-objects-has-no-effect-0bbc16
- https://supabase.com/docs/guides/troubleshooting/database-roles-can-read-request-headers-queued-by-pg_net-ad6357
- https://supabase.com/docs/guides/functions/schedule-functions

## Reviewable installer

`scripts/sql/sandbox-email-scheduler.sql` installs a disabled, named one-minute job.
It targets only the existing Sandbox reminder endpoint. It reads a dedicated Sandbox
secret from Vault at execution time; no secret appears in the job command. Missing,
duplicate or short secrets cause no HTTP request. It does not store Resend credentials
in Supabase. The installer refuses to overwrite an existing job of the same name.

Do not run it before completing the preflight check. Install using Supabase's migration
workflow, then verify job state and security advisors. Scheduled HTTP response bodies
must contain only enabled/sent counts, as the endpoint currently does.

## Setup after preflight and Resend readiness

1. Verify the Resend sending domain. Save the sending key directly in Vercel Preview,
   branch square-sandbox; do not paste it into chat.
2. Follow EMAIL_AND_PLAN_ACTIVATION.md for sender/test-inbox settings. Keep
   TRANSACTIONAL_EMAIL_ENABLED=false while preparing.
3. Generate a dedicated random secret of at least 32 characters. Store the same value
   in Vercel Preview/square-sandbox CRON_SECRET and Supabase Vault under
   vanessa_sandbox_notifications_cron_secret. Do not output decrypted Vault values.
   Never use the Resend key, database password or Supabase service-role key here.
4. Redeploy Sandbox. Make one controlled authenticated disabled-dispatch test; verify
   enabled=false and no emails. Test private endpoint denials and hosted headers.
5. Using disposable Sandbox fixtures, enable test delivery and then activate the named
   job. All test emails still go to info@houseofvanessa.com, including Sub variants.
6. Verify actual one-minute execution history, five-minute unread reminders for both
   roles, read cancellation, expiry/extension cancellation, provider acceptance and
   inbox receipt. Re-run security advisors. Do not activate Live email or renewals.

If Preview Deployment Protection blocks calls, configure a supported private bypass
without exposing the dashboard. Any header credential sent through pg_net has the
same database-login visibility constraint. Do not add a production bypass or grant.

The shared Supabase project means installed extensions are project-wide. Only the
job and its endpoint are Sandbox-specific; production schemas/data remain untouched.

## Controlled activation

SANDBOX_EMAIL_TEST_STUDENT_ID restricts queuing and dispatch to one disposable
account. It does not hide other accounts from Dashboard unread activity. An invalid
value disables sending. This restriction stays in place after activation tests so
existing Sandbox notifications are not flushed. All test recipients remain fixed to
info@houseofvanessa.com. Expanding test scope requires deliberate configuration.

## Verified activation — 10 October 2026

- Configured recipient: info@houseofvanessa.com, corrected by the user.
- Resend reported Delivered for both unread variants and the expiry test.
- Supabase authenticated disabled check returned 200 / enabled=false / sent=0.
- Enabled fixture check returned 200 / sent=3. Read/extension cancellation and
  duplicate check returned 200 / sent=0, with both stale notices skipped.
- The one-minute job is active. Its first automatic run succeeded and the HTTP
  response was 200 / enabled=true / sent=0. Job status alone is not HTTP proof.
- Disposable test records were removed. SANDBOX_EMAIL_TEST_STUDENT_ID remains
  restricted to the removed test ID, so ordinary Sandbox accounts do not trigger
  email. Select a new approved Sandbox test account before further delivery tests.
  Do not clear the restriction or enable customer delivery without explicit approval.
- The previously pasted key was revoked by the user; only its replacement remains.
- Full regression/build passed, dependency audit zero vulnerabilities, 154 hosted
  checks passed and Supabase security advisor showed zero warnings/errors.
- Supabase still shows an outstanding-invoices notice. Inbox placement/spam was not
  independently inspected; Delivered is Resend's receiving-server delivery status.
