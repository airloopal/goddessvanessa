# Shared Sub theme and glass trial — Sandbox, 6 October 2026

Release 2026.10.06.7 is READY on https://goddessvanessa-git-square-sandbox-system-admin.vercel.app. Final code commit: 2781ecc3e58a6a94346f92eb32807ecf8903ffb0. Deployment: dpl_GpdeVGzxE6xXAqiSNQeJtF3468Y8. Main remains 62ccb16b73c55b0307bb85f2201b78cabb9843b8; no Live deployment, schema, credential, payment or session-policy changes were made.

Home and Chat share the same day/night/rose colour contract and floating Home/Chat pill. The measured mobile pill is 254×56px with a 24px radius on both pages. Night page background is rgb(24,15,23); day is rgb(248,241,245). Chat reserves space below its composer and keeps the existing keyboard-open navigation hiding. Send remains visible above the pill.

The glass trial uses translucent panels, backdrop blur and subtle inner highlights on Sub controls/headers/navigation and dashboard buttons/navigation. Foregrounds remain sharp, selected controls retain solid contrast, and solid/reduced-transparency fallbacks are provided. The privacy cover stays opaque. The dashboard night location chip now uses rgb(67,43,58) with rgb(255,243,249) text.

Active Sub sessions resume automatically at Home from Access and the public landing page, after server validation. Cached entry pages recheck. Invalid, expired, offline and failed responses stay on the entry page. Visual editor frames are excluded; Goddess sign-in remains separate.

Verification: complete Sandbox regression suite, dedicated resume tests, dependency audit (zero known vulnerabilities) and build (112 assets) passed. Local browser fixtures verified matching navigation/palettes, day/night visibility, active Access/landing redirect, composer visibility and dashboard glass. Final deployed sweep passed 142 checks including all 112 exact assets, private endpoints, forged identity/CSRF and security headers. Thirty additional source-access and anonymous mutation checks passed.

Local screenshots: sandbox-glass-chat-mobile.png, sandbox-glass-home-mobile.png and sandbox-glass-dashboard.png. Raw results: sandbox-glass-security.json and sandbox-glass-extra-security.json in the workspace root. Screenshots contain only synthetic local records and public brand imagery; no real customer messages or charges were used.

Limits: physical iOS/Android keyboards were not retested. This is regression/deployment verification, not an exhaustive penetration test. Existing MFA-disabled and runtime-log access limitations remain, as does the previously reported Supabase leaked-password protection advisory: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
