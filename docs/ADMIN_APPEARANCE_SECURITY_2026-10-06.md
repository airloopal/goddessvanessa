# Admin appearance and security verification — 6 October 2026

Release 2026.10.06.2 is on live and sandbox, with the restored production purchase flow and sandbox-only email/upgrade work preserved.

## Changes

- One local rounded 24px SVG registry: navigation, account, day/night toggle, action/dialog controls, authoring controls and notifications. No device emoji for admin controls, third-party script, icon font or extra dependency.
- Shared theme tokens for page/panel/control surfaces, primary and secondary text, selected rows, accent, success, warning, error, borders and focus outlines. Fixed the selected pale-pink row, notification dialog, overview tasks and references, request tools, Settings and status badges.
- Notifications have written topic labels, one relevant icon, a name, short preview and time. Repeated messages from the same chat share a row with a count; ticker/sound and chat-opening behavior retained. Alternate notification entry points use the same panel.
- Mobile More-menu contrast and Status navigation visibility fixed. Chat layout retained; timestamps and reply controls remain readable.

## Verification

Both full regression suites passed. After the final CSS/navigation refinements, targeted appearance, status and account-menu regressions passed in both branches. Both builds passed (102 live/104 sandbox assets). Production dependency audits found zero known vulnerabilities.

Automated theme tests enforce at least 4.5:1 for normal text against its assigned surface, plus rounded SVG consistency, no executable SVG/device emoji, explicit notification topics and duplicate-decoration exclusion. Browser checks covered Overview, All Subs, Verification, Settings, Content, Conversations and notification/More dialogs in day/night; mobile used 390×844, desktop 1280×720. Final corrected samples had no low-contrast text findings. Notification panel measured minimum 6.48:1 in day and 9.29:1 in night; Overview night minimum 6.92:1. All six notification topics were shown using synthetic data, with exactly one icon per row. Status badges/navigation were checked in both themes; fresh Status tab had no console errors after the navigation guard fix.

Deployed sweeps passed 128 checks on live and 130 on sandbox, including exact built public assets, security headers, private no-store endpoints, forged identity/pin denial and cross-origin rejection. An additional 26 checks per site covered source/secret exposure and anonymous payment, upload, chat and credential mutations. Live Square checkout reports production mode, ready=true and embeddedReady=true; sandbox reports sandbox mode. No charge made.

## Release evidence

- Live code commit `c32913e940f7fa3f53bfe7f04308d9cf6f41502f`; deployment `dpl_CkDDb86nKdVy25jmVzwogFoQCsAW`, READY and aliased to houseofvanessa.com.
- Sandbox code commit `4f31e23537841031c9c8e7d908c6d65777565801`; deployment `dpl_2tquJ9Wc8A2iuGWL4osPwjdjrzZh`, READY and aliased to square-sandbox.
- Machine-readable sweeps: appearance-production-security.json, appearance-sandbox-security.json and appearance-extra-security.json in the local workspace.

## Limits

The sweep found no new issues within its coverage; it is not a full penetration test or proof against every vulnerability. No authorization rules, database schema, real customer records or payment rules were changed. Existing Goddess MFA-disabled status, Supabase password advisory and denied Vercel runtime-log access remain as documented in the previous sweep. Physical iOS/Android devices, custom user-selected background images and every possible future content combination were not exhaustively checked. The color system supports readable assigned text/surface pairs; future controls should use it.

Screenshots and fixtures contain synthetic accounts and existing public brand media. No real customer messages, emails or payments were used for testing.
