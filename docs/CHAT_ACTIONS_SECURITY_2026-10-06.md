# Chat controls release verification — 6 October 2026

Release 2026.10.06.3 is deployed on live and sandbox. Both Sub and Goddess now have a single rounded SVG emoji control and the same curved reply silhouette in a compact themed circular button beside the timestamp, on desktop and mobile.

Both complete regression suites, builds and production dependency audits passed; audits found zero known vulnerabilities. Synthetic browser fixtures verified one SVG without duplicate text, emoji insertion, reply selection and cancellation, and draft preservation. Day/night desktop and 390px mobile views were inspected. No customer messages, charges, emails or raw customer data were used.

Live code commit: 66f36c79293dfed34429bef9a85bf673f36bd742. Deployment: dpl_DSyhq1Q7SqEVU5vaKyfE4Cu82v1t (READY, houseofvanessa.com).
Sandbox code commit: eac26c284ec64a86590f4f263fefb5315c693a2c. Deployment: dpl_GsPgaYALhYNR9kVh5jLFWLtBGcCF (READY, branch alias).

Post-release checks passed: 128 live and 130 sandbox checks, plus 26 additional checks per site. All 102 live and 104 sandbox public assets matched the tested build. Anonymous private endpoints and mutations were denied; forged identity/pin and cross-origin broadcast requests were denied. CSP, HSTS, nosniff and private no-store responses passed. Source/secret paths were inaccessible. Public payments returned no private contract/entry; live production ready and embeddedReady remain true. No charge was performed. Experimental email/member purchases remain sandbox-only.

Coverage is regression and deployment verification, not an exhaustive penetration test or security guarantee. Existing MFA-disabled status and Supabase password advisory remain. Runtime-log connector access remains unavailable (403). No authentication, database schema or storage policy changed in this release. Physical iOS/Android keyboards were not retested.

Local browser evidence: chat-actions-goddess-mobile.png and chat-actions-sub-mobile.png (synthetic fixtures). Raw sweep results: chat-actions-production-security.json, chat-actions-sandbox-security.json and chat-actions-extra-security.json in the workspace root.
