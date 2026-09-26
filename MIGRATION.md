# Migration implementation and verification

## Preserved presentation

All existing CSS, fonts, images and animation assets are byte-for-byte unchanged. Seven existing frontend files change only login links/labels or the upload transport. The new email sign-in page reuses the access-page classes and styles. There is no redesigned application, chat or dashboard.

The published visual configuration and draft were copied separately to Supabase. The owner draft uses the stable key `owner`; owner authorization still requires a server-verified, email-confirmed Supabase user whose email matches the existing owner.

## Backend

- `api/index.js` is the Vercel Web-standard function entry point.
- `scripts/build.mjs` produces the existing bundled application and a whitelisted static output at `dist/public`.
- PostgreSQL preserves legacy string user IDs, JSON-text snapshots and millisecond timestamps. The adapter maps parameter placeholders and table names; dialect-specific JSON updates, conflict handling and read-state queries are explicitly converted to PostgreSQL.
- Multi-statement writes use transactions. Chat state now has a composite primary key to prevent concurrent duplicates.
- Application tables are in the private `academy` schema with RLS enabled and public grants revoked. No direct browser table access is permitted. Supabase's informational “RLS Enabled No Policy” findings are intentional for these server-only tables: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- The server strips all client-supplied old-host identity headers and validates Supabase users server-side. Owner privileges never come from editable user metadata. Only the Vercel-managed forwarded IP is used for per-IP throttling on Vercel.
- Student chat sessions remain hashed, single-use-code based with HttpOnly cookies. The code is visible to the admin once when issued; only its hash is persisted.
- Direct upload preparation authorizes the conversation, reserves quota in a transaction and returns a signed staging-upload URL. Completion revalidates access, size and detected file type before recording the file/message. Final media and staging buckets are private; files cannot be directly listed or read by public clients.
- Authorized media requests redirect to five-minute signed URLs, avoiding the Vercel response-size limit. These URLs are bearer links valid until expiry, including after logout. Original media URLs still recheck current access.
- Supabase Auth handles owner/applicant email sign-in; Resend handles chat-code delivery. Both need provider configuration before live email tests.

## Verification completed

`npm run build` and `npm test` pass using PostgreSQL via PGlite (not a SQL mock), plus frontend transport tests. Coverage includes:

- Owner authorization, forged/unconfirmed identities, cross-student access denial.
- Draft/publish revision conflicts, visual element validation and saved settings.
- Agreement name/age/policy/revision checks and immutable server-derived amounts.
- Atomic lesson progress, application privacy and verification reply permissions.
- Access-code redemption/expiry/reuse, rotation, suspension, logout and deletion.
- Chat persistence, idempotent sends, typing, unread/read state and presence.
- Private media, byte ranges in the legacy core, signed redirects in the Vercel adapter, MIME validation, size/quota reservation, direct-upload completion/retry and deletion.
- Mocked email success/failure, anti-enumeration and resend throttling; no real email sent.

Remote checks confirmed the schema exists, RLS is enabled, both buckets are private, and the editor settings were imported.

## Remaining live checks

The production Vercel build, actual database connection/TLS credentials, browser cookies/PKCE callback, Storage uploads and email delivery must be verified after the code is uploaded and runtime configuration is complete. Do not interpret passing local tests as a completed deployment.

No payment processing or paid fulfilment was added. Historical SQLite migrations are retained as archive only; do not apply them to PostgreSQL. `supabase/schema.sql` documents the already-applied initial schema; do not run it again on the configured project.
