# Goddess feed — Sandbox release verification, 6 October 2026

Release 2026.10.06.6 is ready at https://goddessvanessa-git-square-sandbox-system-admin.vercel.app. Only square-sandbox was updated. Main stayed at 62ccb16b73c55b0307bb85f2201b78cabb9843b8; production schema and deployment were unchanged.

Goddess publishes from Goddess feed in the desktop sidebar, or More → Goddess feed on mobile. Posts support text only, one photo or one video, a caption, and a fixed GBP donation amount (£1–£1,000). Drafts, editing and removal are supported. Subs land on Home after signing in and have Home/Chat navigation. Post actions are Like and Donate, with no comments, sharing, reposting or bookmarks.

Content is restricted to active authenticated Subs. Draft media and removed-post media are inaccessible to Subs. Author identity, likes and prices are server-owned. Text is escaped. Feed media uses the existing validated private uploader and 50 MB per-file / 1 GB total Goddess feed allowance. Removed media remains available to Goddess and counts toward that allowance; donation evidence is retained. The Sandbox-only media scope constraint change is tracked in Supabase as sandbox_private_goddess_feed_media_scope and documented in supabase/feed-sandbox.sql.

Square hosted donations use a server snapshot of the amount and idempotent checkout records. Competing pending attempts reuse the checkout. Payment redirects do not mark a donation paid: server reconciliation verifies Square's payment, amount, currency and location. A donation does not change contract access or send contract-payment email. Square documentation used: https://developer.squareup.com/reference/square/checkout/create-payment-link.

Validation:
- Complete Sandbox npm test suite passed, including feed-specific ownership, draft/media isolation, CSRF, revision and amount validation, direct uploads, idempotent likes/checkout, fixed provider amount, verified paid state and unchanged contract access.
- npm audit --omit=dev: zero known vulnerabilities. Build: 109 assets.
- Browser fixture verified draft saving, photo upload/publish, Like, donation amount confirmation, mobile More navigation and Sub Home/Chat navigation. Desktop/mobile and dark theme inspected. Fixture content stayed in disposable local storage; no hosted sample posts, customer credentials/messages, emails or charges were used.
- Deployment dpl_7zHbCbtsQ4NrENkWWsrFS8n6yzM2, code commit ca9082b11e3cab2f6542daa62f1aee38ef27294f: READY, correct Sandbox alias.
- Deployed sweep: 139 checks including all 109 exact assets; 30 additional source and anonymous mutation checks passed. Private feed endpoints rejected anonymous access, with no-store responses. CSP, HSTS, nosniff and existing forged-identity/CSRF checks passed. Sandbox Square mode=sandbox and ready=true.
- Both schemas retain media RLS. Public table grants to anon/authenticated/PUBLIC: 0. Production constraint excludes feed; only Sandbox includes it.

Limits: this is regression/deployment verification, not an exhaustive penetration test. Existing MFA-disabled configuration and unavailable runtime-log connector remain. Physical iOS/Android keyboards and a real Square charge were not tested. Supabase's intentional private-table no-policy notices remain; leaked-password protection is still disabled: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

Local screenshots: sandbox-feed-sub-mobile.png, sandbox-feed-admin-desktop.png, sandbox-feed-admin-mobile.png. Raw sweep results: sandbox-feed-security.json and sandbox-feed-extra-security.json in the workspace root. Screenshots show local synthetic posts, not hosted content.
