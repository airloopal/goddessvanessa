# Transactional email and Sub plan activation

The implementation is deployed in stages. Emails and production plan checkout must stay disabled until this checklist passes. Sandbox checkout uses sandbox Square credentials and never sends real emails.

## Agreed behavior

- Resend sends transactional service emails from `House of Vanessa <no-reply@houseofvanessa.com>`.
- Goddess unread reminders go to `goddess@houseofvanessa.com`. Her login identity remains unchanged.
- Both parties receive one short reminder after a conversation has unread messages for at least five minutes. Messages are rechecked before sending. The email uses at most 120 text characters, or “Shared attachment”; it includes no file, filename, access code or recipient list. One reminder per unread episode avoids repeatedly emailing the same backlog.
- Payment, application, access-ready, contract-extension and expiry events are supported. Expiry reminders use 7 days, 24 hours and 1 hour where applicable; 24-hour contracts use the final-hour reminder rather than an immediate renewal prompt.
- The admin notification centre includes overdue unread conversations and account events.
- Each Sub purchase is full-price. Duration begins after the current expiry, or now if already expired. No proration or automatic recurring charge. An infinite contract does not require extension.
- Expired users can open billing with their current code; that capability cannot read chat or media. Replacing the code revokes billing access. Approved legacy users can recover a reusable code after a confirmed own-account renewal.
- Marketing is separate. No audience enrolment, marketing email or promotional campaign is enabled by this work.

## Resend and mailbox setup

1. Create the two mailboxes with your mailbox provider. Resend provides sending and does not replace the mailbox service.
2. Add `houseofvanessa.com` in https://resend.com/domains and add the exact DNS verification records Resend supplies. Keep the existing website DNS and mailbox MX records; sending/return-path records are distinct. Verify the domain before enabling delivery.
3. Create a restricted Resend sending API key. Add it directly to Vercel project settings as production-only sensitive `RESEND_API_KEY`. Do not paste keys into chat or commit them.
4. Already configured: `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL`, `TRANSACTIONAL_EMAIL_ENABLED=false`, production `MEMBER_CHECKOUT_ENABLED=false`, preview `MEMBER_CHECKOUT_ENABLED=true`.

## External scheduler

A standard HTTPS scheduler is supported. cron-job.org is an option: its official FAQ documents one-minute execution and custom headers (https://cron-job.org/en/faq/). No scheduler account or job has been created yet.

1. Generate a random secret of at least 32 characters and save it as production-only sensitive `CRON_SECRET` in Vercel.
2. Set the job to GET `https://houseofvanessa.com/api/cron/notifications` every minute.
3. Set its private request header `Authorization: Bearer <the same CRON_SECRET>`. Keep credentials out of the URL and public response/status pages. The job receives counts only, not message content or recipients.
4. Enable failure alerts for the scheduler owner. Check execution history; a five-minute unread threshold is checked on the next available run, not an exact-to-the-second delivery promise.
5. A Supabase Cron/pg_net setup was attempted without credentials, but its internal-admin-owned networking objects retained public grants that this connection could not remove. The new job and both extensions were removed before any authenticated request or email. The external scheduler avoids storing trigger credentials in that networking queue. Application-table RLS/grants are unchanged.

## Activation acceptance

- Redeploy with verified domain, sending key and scheduler secret.
- Enable `TRANSACTIONAL_EMAIL_ENABLED=true` only after an authorized fixture to Goddess's mailbox confirms accepted delivery and inbox receipt. Provider acceptance alone does not establish delivery.
- Verify five-minute reminder, read-before-send cancellation, expiry reminder, both recipient roles and scheduler history using disposable accounts/messages only.
- Verify a sandbox extension, repeated confirmation and refunded extension. Duration is applied once under concurrent callbacks. Original provider prices stay immutable; an applied renewal refund places access into review.
- Then enable production `MEMBER_CHECKOUT_ENABLED=true` and redeploy. Production checkout also requires configured transactional mail and a long scheduler secret; its flag alone cannot bypass setup.
- Run full regression tests, dependency audit, build and deployed endpoint/header checks after activation. Do not make a real charge during routine testing.

## Limits

Live delivery, mailbox receipt, an actual external scheduler run and physical-device payment-return acceptance remain pending until configuration. Provider errors retry with stable idempotency data inside a bounded 20-hour window; uncertain sends outside that window go to review rather than risking duplicate mail. Review-state queue records currently require operator inspection. No Resend bounce/delivery webhook, marketing campaigns or automatic renewal is included.
