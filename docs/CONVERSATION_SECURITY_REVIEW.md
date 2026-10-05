# Conversation release security review — 5 October 2026

Release: `2026.10.05.1`. This is a targeted application regression and deployment review, not an independent penetration test.

## Release evidence

- Production implementation: `14a29ccfdbb62790ae74920e5835d92af1397963`; Vercel `dpl_241Gdz3PJtK2AN7US278EY25fo1f` READY.
- Sandbox implementation: `e5d39391ab72bc69094cb19dcfe5db1fd1d9b31c`; Vercel `dpl_ArPXRaPGuftRJof3oDVkpXQQkhsL` READY.
- Both implementation commits use the identical tested source tree. Subsequent documentation commits record this evidence without changing executable assets.
- Full `npm test` passed after final code and release-metadata edits. `npm run build` passed (97 assets). Production `npm audit --omit=dev` found zero known vulnerabilities.

## Verified controls

- Hashed reusable codes remain subject to contract payment/refund/expiry and suspension checks. Replacement revokes the previous code; login rotates the session. A regression simulates replacement between lookup and session creation and confirms no stale session is created or current session removed.
- Secure host-only HttpOnly cookies, owner verification, cross-origin denial, forged identity rejection, request streaming limits and session isolation pass existing regression cases.
- Replies must reference the same thread and remain immutable across retries. Broadcast is administrator-only, rate limited, restricted to approved links and eligible conversations, and idempotent. Recipients cannot discover other recipient IDs.
- Profiles/labels remain admin-only. Sub galleries are restricted to their own conversation; file reads retain authorization. Attachment metadata, notifications and download names use generic names.
- Upload actor, scope, expiry, quota, size and signature checks remain. Staging uploads use multipart form data consistent with the installed Supabase SDK. Public buckets or upsert were not enabled.
- Server-controlled prices, signed agreements, SUB50, payment environment separation, webhook checks, refund gates and duplicate-charge protection pass the unchanged payment regression suite. No real payment was made.
- Closing verification requires confirmation and current revision; saved replies remain retained.

## Deployed checks

On sandbox at 06:15 and production at 06:16 Europe/Warsaw:

- Eleven private routes denied anonymous requests with 401/403 and `private, no-store` responses.
- Forged owner headers received 403. Cross-origin broadcast POST received 403 and sent no messages.
- Dashboard returned CSP, HSTS and `nosniff` headers.
- Five changed assets matched the exact tested local bytes.
- Anonymous payment state exposed no member records; sandbox reported `sandbox` and live reported `production`.

The connector's protection-bypass operation was denied, but direct HTTPS endpoint checks succeeded. Vercel runtime-log aggregation separately returned 403; no claim is made that runtime error logs are clear.

## Database and storage review

All 22 application tables across `academy` and `academy_sandbox` have RLS enabled. Neither `anon` nor `authenticated` has SELECT privileges. The no-policy informational notices match the server-only, deny-by-default design; no public policies were added. Both media buckets remain private with 52,428,800-byte limits.

Supabase reports an existing **Leaked Password Protection Disabled** warning. Authentication configuration was not changed in this batch. Review the [Supabase remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) separately. See also [RLS no-policy explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Open acceptance and migration items

- All seven current production Sub accounts have already consumed their legacy code hashes. These deleted hashes cannot be reconstructed. Current sessions were not revoked; issue one replacement through the new mobile profile control when needed. Newly issued codes follow the new contract-duration rules.
- Real Supabase video delivery, phone codecs, private-browser behaviour, microphone draft playback and mobile keyboards require device acceptance. Local browser verification uploaded and played a real MP4 using disposable data/storage.
- Self-service renewal/upgrade checkout is not implemented. Existing members can see prices and request a plan from their current conversation.
- Supplied pink logo is pending. Activity counts are approximate active tabs.
- No real member messages, emails, SMS, payments, schema changes, credentials, access-policy changes or financial-record rewrites were performed.
