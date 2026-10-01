# Security sweep — 1 October 2026

Scope: main release cb3b9f5, deployed production site, academy and academy_sandbox database structure, private storage, Vercel firewall, application and student access, Square and Throne. This is an engineering review and bounded negative testing, not an independent penetration test or DDoS load test.

## Results

- Full automated suite passed: application, agreement records, visual editor authorization, uploads, student isolation, secure sessions, code rotation/revocation, payment amount and stage validation, refund handling, concurrent retries, and authenticator/recovery-code behavior. Additional Throne signature/replay/isolation and replacement-code request tests passed.
- Live negative tests: anonymous admin overview/status, visual draft, education draft and student list returned 403; chat messages/session and gift reference returned 401; unsigned Square and Throne webhooks returned 403; cross-origin application-session creation returned 403. Forged identity headers did not grant access. No actual charges, gifts, emails or agreement submissions were made.
- Public environment/server source paths returned 404 or retired-route 410. Live CSP, HTTPS enforcement, framing restrictions, nosniff and same-origin referrer headers are present. Public payment capability confirms production mode, ready and embeddedReady.
- All 22 application tables have RLS enabled. No anon/authenticated/PUBLIC table grants and no security-definer functions exist in public/academy/academy_sandbox. Both media buckets remain private with a 25 MB limit. Policy-free private tables intentionally deny direct browser access; application authorization is enforced by the server.
- Supabase advisory: leaked-password protection is disabled in Supabase Auth. The platform currently uses its separate private-code authentication, not Supabase password sign-in. Revisit before adding Supabase password authentication.
- Vercel system mitigations active; no system bypasses. Bot Protection off. One prior draft rule logs /.env probes and has not been published. No new firewall rule was applied during this sweep.

## Dependency patch

Production-only npm audit initially reported zero vulnerabilities. Full development audit identified one high and four moderate findings in historic database tools. Upgraded drizzle-orm from 0.44.5 to 0.45.3 and pinned esbuild to 0.25.12 through an override; regenerated the lockfile. Clean npm ci --ignore-scripts, full npm audit (zero findings), build, patched identifier escaping and Vercel API boundary tests passed. Runtime database access uses parameterized pg queries; the development tools are not called by production payment/chat handlers.

References: https://github.com/advisories/GHSA-gpj5-g38j-94v9 and https://github.com/advisories/GHSA-67mh-4wv8-2f99.

## Launch checks still required

- Administrator personally replaces any code previously disclosed in chat and enrolls an authenticator if not already done. Enrollment/credential state was not inspected; no credential was read or changed.
- Confirm recoverable database and separately stored media backups; a restore drill was not performed.
- Connect the final domain, then verify HTTPS, session behavior, Square site/return/webhook URL configuration and Throne callback configuration. Square signs callbacks using the configured webhook URL exactly.
- Run the final application → sandbox entry → agreement → sandbox contract → platform code → private chat walkthrough on a Preview deployment using academy_sandbox. Never use sandbox test cards on the production-mode site. Production intentionally rejects a sandbox database/payment configuration.
- Real Square/Throne transactions remain user-run acceptance tests. Throne confirmations require the student's gift reference; unsupported cancellation/failure events are not claimed.

## Previous review (historical)

# Security review — 30 September 2026

Scope: application, student chat, Vanessa dashboard, private uploads, Square sandbox and Vercel boundary. Changes published to square-sandbox; this is not an independent penetration test or a guarantee of complete security.

## Strengthened

- Application and student cookies use the __Host- prefix, Secure, HttpOnly and SameSite=Strict, with no Domain attribute. Legacy cookies are rejected. Existing sandbox application/student sessions must be renewed.
- Sign-in, JSON and Square webhook bodies have byte limits enforced while streaming; over-limit streams are cancelled before parsing.
- Browser headers restrict forms to the same origin, upgrade insecure requests, enforce HTTPS, prevent external framing and disable geolocation. Same-origin camera/microphone remain available for the existing features.

## Verified

- All application tables in both schemas have RLS enabled. A table-grant query returned no anon/authenticated grants. Private buckets academy-media and academy-uploads are not public and have a 25 MB limit.
- Admin identity headers from callers are discarded. Owner access is verified through the private session. Codes are hashed, logins limited, logout and code rotation revoke sessions.
- Application identity does not grant chat access. Students cannot read another conversation or upload into it. Backgrounds are owner-controlled and isolated.
- Upload completion checks actor, file signatures, quota and ownership. Images, videos and documents are served only after authorization, with short-lived signed reads. SVG/HTML uploads are not accepted.
- Chat text and filenames are escaped. Secrets remain in server code/configuration, not public JavaScript.
- Square prices and stage gates are server-owned. Webhook signatures, location/currency/amount, refunds, idempotency and unknown-response recovery are tested.
- npm audit --omit=dev: zero reported vulnerabilities at review time. Full automated suite passes, including security and image-background tests.

## Boundaries and follow-up

- This chat uses HTTPS and private server storage, not end-to-end encryption. Authorized server operators can access stored messages. Signed media URLs can be used by a holder until their five-minute expiry.
- Change the Vanessa admin access code that was shared in chat before going live. The owner must do this through Account → Settings; no credential was read or changed during this review. Admin access currently uses one factor, not MFA.
- Live payments remain disabled. Production promotion, production flows, backup/restore testing and an independent penetration test remain release checks.
- Automatic approval review rejected a credential-state query as credential probing; it was not retried. Authentication behavior was checked using synthetic test credentials.

## Admin authenticator MFA
Optional enrollment in Settings requires a private 12-digit access code and a valid time-based authenticator code. Enabling invalidates all existing sessions. Sign-in and code rotation require a fresh authenticator code or a single-use recovery code. Setup keys are encrypted with AES-256-GCM under an independent scrypt-derived key from the raw access code; recovery codes are stored only as hashes. Concurrent recovery attempts use compare-and-swap so only one succeeds. Enrollment is incomplete until the administrator personally verifies their authenticator. No enrollment secrets or recovery codes are included in logs or screenshots.

Verification: RFC 6238 SHA-1 vectors, encrypted-secret wrong-key and tamper rejection, session-bound enrollment, OTP replay rejection, concurrent recovery use, code rotation preserving MFA, and session revocation pass in synthetic tests. Backups and production firewall custom-rule publication remain operator actions; database backups must also cover separately stored media.
