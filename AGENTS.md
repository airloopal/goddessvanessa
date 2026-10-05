# Release requirements

For every future platform change, run the security regression suite (`npm test`), production dependency audit (`npm audit --omit=dev`), and build (`npm run build`) before deployment. Add targeted security cases when authorization, payments, uploads, links, or sessions change. Verify deployed private endpoints and security headers after deployment. Report actual coverage and unresolved limitations; never claim immunity to malware, penetration, or DDoS attacks.

Apply authorized platform changes to both `main` and `square-sandbox`, preserving separate payment modes, credentials, and database schemas. Never charge real money during routine verification.

Chat links: Sub messages cannot contain web links. Only authenticated Goddess messages may create clickable HTTPS links to the explicit approved destinations. Do not broaden the allowlist without reviewing the destination and its redirect risks. Escape message text, keep sender identity server-owned, and open approved links with `noopener noreferrer`.

## Bug-fix logbook

For every future bug fix, add or update an entry in `docs/BUGFIX_LOGBOOK.md` before reporting completion. Record symptoms, evidence, confirmed or inferred cause, patch, security/regression validation, live and sandbox commit identifiers, data handling, and unresolved limitations. Mark an incident resolved only when the relevant flow has been verified; record user confirmation when received. Never include client identifying details, card data, tokens, access codes, secrets, or raw client recordings. Keep existing entries and update their status as new evidence arrives.

## Current production/sandbox split — 2026-10-05

The user explicitly requested that the latest transactional-email and self-service renewal/upgrade work remain on square-sandbox only. Production main was restored to the verified 2026.10.05.5 purchase flow. Do not promote the sandbox tree or its email/member-purchase modules to main until the user explicitly authorizes their production activation. Apply unrelated fixes separately to each branch, preserving this divergence and the tribute-return fix. Fetch the current main tree before every production change; the local goddessvanessa folder retains sandbox work, while live-restored contains the restored production source. This instruction supersedes the general paired-branch rule for these experimental features.
