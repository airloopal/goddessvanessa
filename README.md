# House of Vanessa — current source handover

Exported from published version 59, commit b963be0b80a72405326fae6f8796dca8fd7f1be5.

## Status — read before importing into Vercel

This is the source of the working hosted site. It is NOT a completed Vercel port.
The included build produces a Cloudflare Worker, not a Vercel Function. A GitHub
upload alone does not migrate the backend. Keep the original site live and do
not point the production domain to Vercel yet.

## Upload to GitHub

1. Extract the ZIP on your computer.
2. Open the `vanessa-source` folder.
3. In your GitHub repository, use Add file → Upload files.
4. Upload the CONTENTS at the repository root: `public`, `server`, `db`,
   `drizzle`, `scripts`, `package.json`, the lockfile, this README, and the
   remaining configuration files. Do not upload the ZIP as a single file.
5. Include `.openai` and `.gitignore`. On macOS, Command–Shift–period shows hidden
   files in Finder. These contain source configuration, not secret credentials.
6. Commit the files. If more than 100 files are selected, upload the folders in
   separate batches. If Vercel automatically starts a build, it is not yet a
   working migration; leave the original domain and site in place.
7. Share the repository URL so the Vercel-specific port can continue.

## Included

- The 51 frontend assets currently served: HTML, CSS, JS, fonts and public imagery.
- Active server code for accounts, private chat, media, email, learning records,
  verification and the visual editor.
- Database schema and all migration history needed to reproduce its structure.
- Lockfile, build script and automated integration checks.
- A file checksum manifest for the exported source files.

Obsolete, unserved legacy prototypes were not reintroduced. The existing site
was not modified by this export.

## Not included

- Live database rows: student records, messages, agreements, saved editor
  overrides, published/draft course configuration and verification requests.
- Private uploaded files held in object storage.
- Runtime secrets, passwords or repository credentials.
- A payment integration (none is connected in this source).

Database schema is not a database backup. These live records and files need a
separate authorized transfer before cutover. Published editor settings are
stored in the database, so the source alone cannot reproduce any such overrides.

## Local source checks

Use Node.js with the built-in `node:sqlite` module available (the checks use it).

```sh
npm ci
npm run build
node scripts/check-integrations.mjs
node scripts/check-chat.mjs
node scripts/check-preview-access.mjs
```

The tests use a temporary in-memory database, simulated object storage and a
simulated email provider. They do not send real email or test a live Vercel site.

See `MIGRATION.md` for the remaining port and cutover work.
