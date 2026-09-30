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
