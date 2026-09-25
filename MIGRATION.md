# Vercel migration checklist

## Preserve the UI

Keep current public asset names, routes, Poppins fonts, colours and existing
responsive layouts. Deploy only the assets selected by scripts/build.mjs.
Do not publish server source, migration files or environment values as static
assets. Preserve the CSP and media authorization rules.

## Backend requirements

| Current component | Work required for Vercel |
| --- | --- |
| Worker fetch(request, env) | Adapt handlers to a supported Vercel runtime and route configuration. |
| D1 DB binding and SQLite queries | Choose a durable database, create a compatible adapter or port queries, then transfer records. Local serverless SQLite files are not a persistent database. |
| R2 BUCKET binding | Connect private object storage and port put/get/delete, byte ranges, ownership and deletion cleanup. Export existing bytes and metadata. |
| Host-provided ChatGPT admin sign-in | Replace with trusted server-validated authentication. Never trust visitor-supplied oai-authenticated-user-* headers on Vercel. |
| Student access-code cookies | Keep random single-use codes, hashed storage, expiry, throttling, CSRF checks and session revocation. Issue new sessions after domain cutover. |
| Media uploads up to 25 MB | Check Vercel request-body limits; use authenticated direct-to-storage uploads where required rather than assuming the current binary upload endpoint will work. |
| Access-code emails | Keep RESEND_API_KEY server-side and EMAIL_FROM configured with an approved sender. No keys are included. |
| Configuration/visual editor | Transfer prototype_settings, visual_site and relevant draft records; preserve revision checks. |

The existing `.openai/hosting.json` documents the original runtime bindings. It
is not a Vercel configuration. The code currently trusts identity headers
because its original host injects them; this trust must not be carried over to
public request headers on a new host.

## Data transfer

1. Select destination database, private file storage and administrator auth.
2. Take a database backup/export and enumerate private media objects using an
   authorized export mechanism. Current source files contain none of this data.
3. Preserve relationships, stable IDs, attachment keys, agreement snapshots and
   code hashes. Avoid transferring active sessions; issue fresh codes instead.
4. Copy media bytes privately and compare counts, sizes and checksums.
5. Reconcile writes made on the old site after the initial snapshot. Arrange a
   short write pause only for final synchronization, not throughout development.

## Acceptance checks before switching the domain

- Anonymous visitors cannot impersonate the owner with forged headers.
- Two students cannot read each other's records, conversations or media.
- Code issuance, redemption, replacement, expiry, suspension and logout work.
- Student/admin messages sync across devices without duplicate sends.
- Private uploads, downloads, audio/video ranges and verification visibility work.
- Deleting a chat account removes its chat attachments as intended.
- Enrolment and lesson progress survive reloads and concurrent updates.
- Visual editor draft/publish and revision conflict behavior is preserved.
- Desktop/mobile layouts match the retained design.
- Email is actually delivered using the configured sender.

Only then change DNS, monitor failures, and retain the old site as a rollback
option. No custom-domain switch or destination deployment has been performed.

Reference documentation:
- https://vercel.com/docs/functions/runtimes
- https://vercel.com/docs/functions/limitations
- https://vercel.com/kb/guide/is-sqlite-supported-in-vercel
- https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
