# UI checklist and security verification — 6 October 2026

The requested 15 changes are released on live and sandbox as 2026.10.06.1. Production retains the restored Square tribute/contract flow. Experimental email delivery and self-service membership purchases remain sandbox-only.

| Request | Result and evidence |
| --- | --- |
| Photos/videos open in chat | Private same-page lightbox; one close button, Escape/backdrop close and focus return. Image loaded and video readyState=4 in browser fixture. |
| Live visitor locations | Owner-only active city/country counts, refreshed with statistics. Hosting IP geolocation only; no GPS, coordinates, postcode or raw IP stored. Last 90 seconds active; stale location is scrubbed on subsequent visit updates. VPNs may affect accuracy. |
| Overview then Conversations in menu | Verified desktop/mobile order. Conversations remains the landing tab. |
| Needs your attention under live statistics | Verified one panel, immediately after live stats and before latest applications. |
| Compact selector without presence | Avatar/initials, name, one-line message preview, time, unread count and separate pin. Rows measured 65px. |
| Themed reply control | 23px circular control follows chat colors; timestamp/reply stay together. |
| Paragraph-growing input | Five paragraphs measured 124px desktop, three measured 98px mobile. Growth capped to preserve thread and Send visibility. |
| Evenly spaced mobile tools | Six 40px tools spaced evenly across 390px viewport. |
| Green Online / blank offline | Header presence green when online; offline text and dot blank/hidden. |
| Basic/Advanced icons | Silver Basic and gold Advanced crown next to name, accessible labels. Both fixture states verified. |
| Smaller mobile name backdrop | Mobile profile header measured 79px, name 16px, avatar 36px. |
| Compact profile cards | Smaller banner/avatar/name/detail spacing; application answers remain collapsed. All Subs mobile list verified. |
| Friendly essential notifications | Only name, short activity preview and time; messages, gifts, payments, applications, verification and access-code requests. No contact fields. |
| Notification ticker | Fresh unseen activity counts; clears when centre opens. Test verified six event kinds counted once. |
| Real-time notification sound | Gentle chime for each fresh batch of all six event kinds, deduplicated; independent of desktop permission. Requires user interaction and open dashboard, subject to browser background throttling. Sound switch in Settings. |

## Released versions

- Live code commit: `29fdfc1ed8edcd8801369a4b4392f4698915f963`; deployment `dpl_BanwUCL4VkqSzhzgShs4zdaqmApt`, READY and aliased to houseofvanessa.com.
- Sandbox code commit: `4292c90eb4a6251672a791703063347b1075f991`; deployment `dpl_H9GgSWBjdKeuj9hkNriu5Y3SfMoM`, READY and aliased to square-sandbox.
- Live Square checkout reports production mode, ready=true and embeddedReady=true. Sandbox reports sandbox mode. No charge performed.

## Security coverage

Both full regression suites passed, including payments, sessions, private chats/media, upload validation, owner authorization, CSRF, idempotency and the new UI cases. Both builds passed (100 production and 102 sandbox assets). Both production dependency audits found zero known vulnerabilities.

Deployed checks passed: 126 production checks, 128 sandbox checks and 26 additional source-exposure/anonymous-mutation checks per site. All built public assets matched deployment bytes; private activity/location/media endpoints denied anonymous requests and used no-store; forged owner headers, pin mutations and cross-origin broadcast were denied. Secret/server source paths were unavailable. Unauthenticated payment, account, media and chat mutations were rejected. Local role tests also denied learner access to the new activity/location endpoints and forged geo bodies.

Supabase metadata rechecked: all 22 application tables have RLS enabled; zero anon/authenticated table grants; both media buckets private with 50 MiB limits. No database schema or authorization grants changed.

## Remaining limits

Goddess two-step verification is disabled in both environments. Enable it through the dashboard account flow; this requires the owner’s authenticator setup. Supabase’s existing leaked-password-protection advisory remains; the site uses its own code-based Goddess authentication, so this advisory is not an assertion that the site password flow is compromised. [Advisory guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Vercel runtime logs could not be inspected: the connector returned 403. There is no claim of clean runtime logs. Mobile evidence uses a 390×844 browser viewport; physical iOS/Android keyboard behavior was not re-tested on real devices. Regression and endpoint checks are not a full penetration test or guarantee against every vulnerability.

No real customer messages, emails, charges, refunds or private recordings were used in tests. Screenshots show synthetic accounts and existing public brand assets.
