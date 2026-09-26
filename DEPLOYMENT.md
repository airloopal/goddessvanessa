# Deploy the migration

Target: Vercel team `system-admin`, project `goddessvanessa`.
Repository: `airloopal/goddessvanessa`, branch `main`.

## 1. Upload the update to GitHub

Extract `Vanessa-Vercel-Update.zip`. Upload the contents of its `UPLOAD-TO-GITHUB` folder to the root of the existing repository, preserving the folder structure, and commit.

Do not upload the ZIP itself. This update contains only changed/new files; existing fonts, images and other site assets stay in the repository. There are fewer than 100 files to upload.

The existing `.openai/hosting.json` and historical `drizzle` files may remain: the Vercel build does not use them. Do not upload any `.env` file or database export.

## 2. Vercel build settings

Connect the existing project to `airloopal/goddessvanessa` if its Overview still shows “Connect Git Repository.”

- Framework: Other
- Root directory: repository root
- Node.js: 24.x
- Build command: `npm run build`
- Output directory: `dist/public`
- Install command: `npm ci`

The supplied `vercel.json` configures the build, API routing, security headers and legacy redirects. Do not set the output to `public` or `dist/server`.

## 3. Environment variables

Set the following in Vercel Settings → Environment Variables. Use Production for the production project. Do not expose secret values in screenshots, chat or GitHub.

| Variable | Value/source |
| --- | --- |
| `SUPABASE_URL` | `https://hlmlqdkcwchmzxbcvrtp.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase project publishable key. Existing integration variables `SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are accepted as alternatives. |
| `SUPABASE_SECRET_KEY` | Supabase server secret key. Existing `SUPABASE_SERVICE_ROLE_KEY` is accepted as an alternative. Never use a `NEXT_PUBLIC_` name for this secret. |
| `DATABASE_URL` | Supabase Connect → transaction-pooler PostgreSQL URL, including database password. Existing integration `POSTGRES_URL` is accepted as an alternative. |
| `DATABASE_CA_CERT` | Only if required: the project's downloaded database root certificate as PEM. Certificate verification stays enabled. |
| `RESEND_API_KEY` | Resend key for sending student chat access codes. Optional until email delivery is enabled. |
| `EMAIL_FROM` | Verified sender, e.g. `Academy <access@your-domain>`. Must match a verified Resend domain. |

The Supabase/Vercel integration may have populated some of these already. Check the names before adding duplicates. The publishable key is not a database password. The service key is not a PostgreSQL connection string.

## 4. Supabase email sign-in

Once Vercel assigns the production website URL:

1. In Supabase Authentication → URL Configuration, set Site URL to that HTTPS website origin.
2. Add an allowed redirect for `https://YOUR-ACTUAL-HOST/api/auth/callback**`.
3. Configure custom SMTP for reliable sign-in email delivery to students. Supabase's built-in mail service is restricted and is not a production email solution.
4. Keep the default confirmation-link template. This implementation uses PKCE and exchanges the returned `code` server-side. Open the link in the same browser that requested it.

The owner email remains `danielvernontp@gmail.com`. Sign in at `/signin.html?return_to=%2Fdashboard.html` with that address. A Supabase Dashboard login does not automatically create an application login session.

Students continue to use `/access.html` and their 48-character, single-use chat codes. The administrator can issue these manually through Applications/Conversations. If Resend is configured, the code is emailed as well.

## 5. Check before changing the domain

1. Open `/api/health`: expect `ok: true` and `database: true`. The storage/email flags report configuration presence, not external delivery success.
2. Check the landing page, application, access page and dashboard at desktop and mobile sizes.
3. Sign in as owner and save/publish an editor change, then restore it.
4. In another browser, sign in by email, save an application review, then redeem the issued chat code.
5. Send messages both ways, check typing, read states, and upload an image, PDF and a video over 4.5 MB.
6. Check verification request/reply, logout, code expiry/replacement and account suspension.
7. Confirm actual sign-in and access-code emails reach the intended inbox.

Only after these pass should the existing domain be moved. Recheck the original site's database for any records created since the migration snapshot before cutover.

## Maintenance

Run `node --env-file=.env scripts/maintenance.mjs` periodically from a trusted administrative environment. It removes expired staging uploads, expired sessions and rate-limit records in bounded batches. Do not commit that `.env` file.
