# Sandbox email reminders and activation

Current scope is **Sandbox only**. Live email/renewal runtime remains excluded. Resend sender domain and the Sandbox key are configured. Supabase scheduling was selected instead of the external scheduler; see SUPABASE_EMAIL_SCHEDULER.md. Controlled activation is restricted to a disposable test account. Live remains unchanged.

## Finished behavior

- One reminder per unread episode after **at least five minutes**, for both Sub and Goddess. With a one-minute scheduler, the first check normally happens between five and six minutes; scheduler/provider delays can add time.
- A preview contains at most 120 characters. Attachments use “Shared attachment”; filenames, private codes, long card-like numbers and message links are omitted. HTML text is escaped, with no tracking images.
- Read status is checked again immediately before sending. A message read before dispatch cancels its reminder. Existing queued episodes do not block later conversations from being queued.
- Expiry reminders use **7 days, 24 hours and 1 hour**, where the contract is longer than the corresponding interval. A 24-hour contract gets the final-hour reminder. Ended/infinite contracts are not reminded. Extending a contract cancels reminders for the old expiry.
- Sandbox uses Sandbox contract records and Sandbox URLs. Native card payment, application stages and rates are unchanged.
- Sender: `House of Vanessa <no-reply@houseofvanessa.com>`. Intended Goddess recipient: `goddess@houseofvanessa.com`.
- **All Sandbox test delivery is restricted to `goddess@houseofvanessa.com`, including the Sub version.** A different test recipient or missing opt-in disables delivery. Access-code emails are suppressed in Sandbox even after a Resend key is added.
- Resend responses are recorded as **accepted by email service**, not delivered. Provider ID is retained privately. Retry uses the original body and idempotency key; recipient changes or an uncertain retry beyond 20 hours require review. Accepted/skipped messages discard cached payloads.
- Admin Dashboard → Notifications → **Email reminders** shows three preview templates, configuration status, queue counts and the last authenticated scheduler check. Templates use sample text only and cannot send emails. The preview endpoint requires Goddess access and never returns customer addresses, previews, provider IDs or secrets.

## Set up Resend

1. Create/sign into https://resend.com and add `houseofvanessa.com` under Domains. Add **only the DNS records Resend provides**, preserving existing website and mailbox records. Verify the domain. Resend sends emails; existing mailboxes still need a mailbox provider.
2. Create a restricted sending API key. Add it directly to Vercel as sensitive `RESEND_API_KEY`, target **Preview**, branch **`square-sandbox`**. Never paste it into chat or commit it.
3. In the same Preview/`square-sandbox` scope, set:
   - `EMAIL_FROM=House of Vanessa <no-reply@houseofvanessa.com>`
   - `ADMIN_NOTIFICATION_EMAIL=goddess@houseofvanessa.com`
   - `SANDBOX_EMAIL_TEST_TO=goddess@houseofvanessa.com`
   - `TRANSACTIONAL_EMAIL_ENABLED=false` until the fixture test is ready.
4. Keep existing Sandbox Square credentials, schema, `SQUARE_ENVIRONMENT` and `SQUARE_SITE_URL` unchanged. Do not copy production credentials or enable Live email.

Official references: https://resend.com/docs/dashboard/domains/introduction and https://resend.com/docs/dashboard/emails/idempotency-keys.

## Alternative external scheduler: cron-job.org (not selected)

Its official FAQ documents one-minute execution, custom request headers and failure alerts: https://cron-job.org/en/faq/. No account/job has been created by this work.

1. Create/sign into https://console.cron-job.org. Generate a random secret of at least 32 characters and save it as sensitive **Preview / `square-sandbox`** `CRON_SECRET` in Vercel.
2. Redeploy Sandbox with those settings.
3. Create a job with these exact settings:
   - URL: `https://goddessvanessa-git-square-sandbox-system-admin.vercel.app/api/cron/notifications`
   - Method: **GET**
   - Schedule: **every minute**
   - Private header: `Authorization: Bearer <the same CRON_SECRET>`
   - Timeout: **30 seconds**
   - Failure alerts: **enabled**
4. Keep the secret out of URLs, public logs, screenshots and chat. The job receives only enabled/sent counts, never message content or recipients. Keep the job disabled until setup/fixture testing is ready.
5. If Preview Deployment Protection blocks the scheduler, use Vercel's supported protection bypass header configured privately for this job. Do not make the dashboard public or weaken its authentication.
6. We are not reintroducing Supabase Cron/pg_net; the earlier attempt was removed because networking grants could not be restricted through that connection.

## Remaining activation test

After setup, use disposable Sandbox messages/contracts only. Set `TRANSACTIONAL_EMAIL_ENABLED=true` in **Preview / `square-sandbox`** and redeploy, then enable the one-minute job. This sends both reminder variants to Goddess's test inbox only.

Verify:
- Resend acceptance **and inbox receipt**, both roles, a five-minute unread case, read-before-send cancellation, attachment redaction and no repeat backlog email.
- An expiry reminder and cancellation after a Sandbox extension.
- Actual cron-job.org execution history and the Dashboard's last-check time.
- No change in Live delivery, stages, payment flow or customer records.

General self-service contract renewal remains separate Sandbox work: a full-price purchase adds duration after the current expiry, or begins now if expired. No automatic billing or marketing audience is enabled. Do not promote email or renewal runtime to Live until explicitly approved and the delivery checks above pass.

## Verification limits

Code and templates can be verified using intercepted delivery and a disposable database without a sending key. Real Resend delivery, DNS verification, inbox receipt and external scheduler execution remain pending. Provider acceptance alone is not proof of delivery. Bounce/delivery webhooks and marketing campaigns are outside this change.

The selected Supabase job and its credential transfer were explicitly approved.
SANDBOX_EMAIL_TEST_STUDENT_ID keeps activation confined to one disposable account;
all variants go to Goddess's test inbox, with no existing backlog dispatch.
