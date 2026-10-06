# Live publication — 7 October 2026

Authorized by the user: publish all new Sandbox features and fixes while keeping email and renewal work Sandbox-only.

## Included

Private Goddess feed for text/photos/videos, admin drafting/publishing, Likes and fixed donations, on-page Square card fields with shared Retry/Success, Home/Chat navigation and palette, glass controls, and protection for an application coexisting with a different logged-in Sub. Existing dashboard/chat cosmetic and access-code work remains included.

## Preserved and excluded

Production's initial tribute/contract checkout and native return recovery are retained. The original manual Contract options request flow, mail module, admin paid-activity support, auth and environment/database selection remain unchanged. Transactional queues, five-minute email scheduler, billing/renewal modules, plan purchase pages and their API routes are excluded from the Live runtime. No email/renewal activation or environment-variable change was made.

No Sandbox customer/session/media/payment/post data was copied into Live. A production-only, atomic private media constraint change permits `feed`; RLS and table grants remain unchanged. Migration: `live_private_goddess_feed_media_scope`, recorded in `supabase/feed-production.sql`.

## Verification

Production assembled from main 62ccb16b73c55b0307bb85f2201b78cabb9843b8 and tested Sandbox source 087f421592d7631064663832188fb681b572b4c2. Complete production regression suite passed, production dependency audit found zero known vulnerabilities, build emitted 113 assets, and the explicit exclusion/preservation regression passed. Local disposable mobile UI verified the manual plan flow and mounted Square card form with no browser errors. No real charge, refund or outgoing email was performed.

Deployment and hosted verification evidence is recorded after publication in BUGFIX_LOGBOOK.md. Existing MFA/password-hardening advisories and physical-device/bank challenge acceptance limits remain as previously reported.

## Recovery

The prior main commit is the source rollback reference. The feed-scope migration broadens a private constraint and remains compatible with the prior runtime; customer data must not be deleted merely to reverse code publication.
