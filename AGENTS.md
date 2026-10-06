# Release requirements

For every future platform change, run the security regression suite (`npm test`), production dependency audit (`npm audit --omit=dev`), and build (`npm run build`) before deployment. Add targeted security cases when authorization, payments, uploads, links, or sessions change. Verify deployed private endpoints and security headers after deployment. Report actual coverage and unresolved limitations; never claim immunity to malware, penetration, or DDoS attacks.

Follow the standing environment policy below: Sandbox-only work does not authorize updates to `main` or Live. Preserve separate payment modes, credentials, and database schemas. Never charge real money during routine verification.

Chat links: Sub messages cannot contain web links. Only authenticated Goddess messages may create clickable HTTPS links to the explicit approved destinations. Do not broaden the allowlist without reviewing the destination and its redirect risks. Escape message text, keep sender identity server-owned, and open approved links with `noopener noreferrer`.

## Bug-fix logbook

For every future bug fix, add or update an entry in `docs/BUGFIX_LOGBOOK.md` before reporting completion. Record symptoms, evidence, confirmed or inferred cause, patch, security/regression validation, live and sandbox commit identifiers, data handling, and unresolved limitations. Mark an incident resolved only when the relevant flow has been verified; record user confirmation when received. Never include client identifying details, card data, tokens, access codes, secrets, or raw client recordings. Keep existing entries and update their status as new evidence arrives.

## Current production/sandbox split — 2026-10-05

The user explicitly requested that the latest transactional-email and self-service renewal/upgrade work remain on square-sandbox only. Production main was restored to the verified 2026.10.05.5 purchase flow. Do not promote the sandbox tree or its email/member-purchase modules to main until the user explicitly authorizes their production activation. Apply unrelated fixes only to the environment explicitly named by the user, preserving this divergence and the tribute-return fix. Fetch the current main tree before every production change; the local goddessvanessa folder retains sandbox work, while live-restored contains the restored production source. This instruction supersedes the general paired-branch rule for these experimental features.


# Vanessa project environment policy — effective 6 October 2026

These standing instructions apply to houseofvanessa.com / Goddess Vanessa work in this project, including future chats using this workspace. The user explicitly established this policy on 6 October 2026.

- Work solely on the Sandbox/Test site by default. Develop and verify the current session there, then deploy its approved work to Live only when the user explicitly requests that promotion.
- The user will prefix bug/change prompts with **Live** or **Sandbox**. Respect the named environment. A Live label authorizes work scoped to Live; it does not authorize promoting unrelated sandbox changes.
- If a relevant bug/change prompt lacks an environment label, remind the user to specify **Live** or **Sandbox**. Continue only safe inspection/preparation while clarification is pending; do not mutate or deploy either hosted environment based on an assumed label.
- Never automatically apply a Sandbox fix to Live or pair updates across both branches. Preserve the existing production purchase flow and sandbox-only email/member purchase work until explicit promotion is authorized.
- Keep all security/regression and bug-fix logbook requirements. Promotion must preserve the intended environment-specific credentials, payment mode and database schema, and verify the approved flow after deployment.
- This policy supersedes older instructions requiring every platform change on both main and square-sandbox. No Live deployment is authorized merely by a request for Sandbox work.
