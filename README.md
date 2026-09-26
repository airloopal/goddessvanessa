# House of Vanessa — Vercel migration

This migration retains the existing HTML, CSS, fonts, images, animations, application review, admin dashboard, access-code chat and visual editor. The backend runs in a Vercel Node.js function with Supabase PostgreSQL, Auth and private Storage.

## Current state

- Supabase project: `hlmlqdkcwchmzxbcvrtp`.
- Database schema `academy` and private buckets `academy-media` / `academy-uploads` have been created.
- Published visual settings and the owner draft were copied from the original site on 26 September 2026.
- The original live database had no education enrolments, chat students, messages or media records at that inspection.
- Automated PostgreSQL/API tests pass. No real emails were sent.
- This package has not been deployed to Vercel or tested in a live two-browser session.
- The original site remains live. No domain changes were made.

See `DEPLOYMENT.md` for the exact next steps and `MIGRATION.md` for implementation details and test coverage.

## Local development

Use Node 24, then `npm ci`, `npm run build`, and `npm test`.
`npm run dev` starts a local preview. Configure environment variables separately for real APIs. Secure login cookies require an HTTPS deployment.

This package does not collect payments. Agreement amounts and accepted versions are recorded, with payment status `not_collected`.
