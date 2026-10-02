# Release requirements

For every future platform change, run the security regression suite (`npm test`), production dependency audit (`npm audit --omit=dev`), and build (`npm run build`) before deployment. Add targeted security cases when authorization, payments, uploads, links, or sessions change. Verify deployed private endpoints and security headers after deployment. Report actual coverage and unresolved limitations; never claim immunity to malware, penetration, or DDoS attacks.

Apply authorized platform changes to both `main` and `square-sandbox`, preserving separate payment modes, credentials, and database schemas. Never charge real money during routine verification.

Chat links: Sub messages cannot contain web links. Only authenticated Goddess messages may create clickable HTTPS links to the explicit approved destinations. Do not broaden the allowlist without reviewing the destination and its redirect risks. Escape message text, keep sender identity server-owned, and open approved links with `noopener noreferrer`.
