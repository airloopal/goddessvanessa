# Conversation release security review — 5 October 2026

## Conversation workspace addendum — release 2026.10.05.3

Production implementation `a6c0b7949902281b557b95f25795969769e1c08c` and sandbox implementation `262a8b020659366e5f0b67ec9e9f5fd1436f449f` deployed READY. Conversations is the landing tab; Overview prioritizes Latest Applications and collapses supplementary charts/tasks. Admin tools are grouped above input, Send is white on burgundy, back is arrow-only, and the draft reply X preserves input. Desktop thread fills available height and the redundant floating launcher cannot overlap Send. The established Sub bubble layout and theme remain retained.

Final npm test/build passed, production dependency audit found zero vulnerabilities. Added read-receipt regression cases ensure the hidden mobile chat list and other dashboard sections do not mark a conversation read, while a visible mobile/desktop thread does. Browser verified a six-message unread badge in mobile list, cancellation preserving a typed draft, exactly one emoji control, a 674 px desktop thread, visible Send and compact Overview, with no observed console errors. An emoji mount loop found in local preview was fixed before release.

Both hosts passed anonymous/forged/cross-origin denial, no-store and security headers, twelve exact-asset comparisons and separate payment mode checks. No authentication, authorization, schema, credential, price, payment or real-client message change was performed. Earlier runtime-log permission and Supabase leaked-password warning limitations remain unchanged. Physical device keyboard/microphone acceptance remains separate. Documentation follow-ups retain this same executable source.

## 07:19 addendum — release 2026.10.05.2

Production implementation `51be41505994e0889f69c4c353421d6737ce42e2` and sandbox implementation `4d806707fe58914ce08c9ab9078c5e05419651c3` deployed READY. UI refinements preserve the existing theme, private media and message security. Pins use the existing private settings table; mutations are owner-only, boolean/UUID validated, nonexistent targets rejected, and pins are cleaned up on chat deletion. Targeted tests cover unauthorized Sub requests, CSRF, malformed pins, persistence, ordering and unpinning. Final full regression suite and build passed; production dependency audit found zero vulnerabilities.

Browser checks at mobile/desktop sizes confirmed Settings relocation, separate mobile list/thread, single-icon closes and shared compact rendering in admin, floating and Sub chat. Short bubbles measure 45.8 px at 12 px text; voice bubbles measure 64 px. Device keyboard/microphone acceptance remains separate.

Deployed checks on both hosts: eleven private routes denied anonymous access with no-store responses; forged identity and pin mutations and cross-origin broadcast returned 403; security headers retained; twelve checked assets matched local source; payment modes stayed separate. Earlier runtime-log access and Supabase authentication warning limitations below remain unchanged. No schema, credentials, grants, real charges or real member messages changed. Subsequent documentation commits retain the identical executable source.

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
