# Live account management — 11 October 2026

Authorized Live scope: Sub Login wording; timed account deactivation; deletion review; a personal, single-payment 25% Contract retention offer. The user confirmed paid access continues counting down and discounts do not stack. The offer is shown only after the Sub chooses to continue with deletion after their break, not when deactivating or returning normally.

## Flow

1. Active Sub opens Account management from their profile or Chat Manage menu and chooses 7, 14 or 30 days.
2. All existing Chat sessions close. Chat, feed and private media stay unavailable during the break. Messages and profile remain; paid access deadlines do not move.
3. After the period the Sub can return normally. Choosing to continue with deletion first presents the retention offer; declining requires one of five reasons and sends a pending request.
4. Goddess reviews the request from Notifications, Settings or that Sub profile. Approval grants permission, and the Sub separately confirms permanent deletion. Decline leaves the account undeleted. Existing signed agreements, application and payment records remain separate.
5. An accepted offer applies to one next payment for the existing published Contract plan at 25% off, without another discount. Goddess creates and privately shares its payment link. The server owns amount, plan and recipient. Existing one-off payments/extensions require review instead of being overwritten. Provider-confirmed payment extends access after its existing expiry; replay does not add another term.

The deactivated Sub can recover only account-management access using their current code, including after paid access expires. This uses a separate secure cookie and never unlocks Chat, feed or media, revives paid access, or changes application state. New access-code issuance revokes management sessions. No customer account is automatically deactivated, granted a discount or deleted by deployment.

## Verification

Build and full regression suite passed, including payment/session/privacy and legacy-code protections. New disposable-database tests cover all three break durations, unchanged paid deadlines, current-code recovery, management-only cookies, expired paid access denial, mandatory deletion intent/reason, stale revisions, CSRF, owner approval, separate final deletion and cross-account cleanup. Retention checkout uses a mocked provider: immutable price, no stacking, one checkout, exact amount/currency/location, replay-safe quarter duration, preserved earlier extension and refund review. No real charge, signature, customer email or deletion was performed.

Mobile 390×844 and desktop browser checks verified the post-break screen has no retention offer until deletion is selected, request submission, Admin notifications opening the correct Sub, Settings controls and light/dark readability. Proof images are saved locally beside this document. Production dependency audit: zero vulnerabilities. Supabase security advisor: only 22 informational RLS-without-policy findings for the intentionally private, denied-by-default Live/Sandbox tables; no warning/error findings. No database migration, grants, environment credentials, scheduler jobs or Sandbox changes are included.

Hosted exact-asset and authorization verification is recorded separately after release. Application stages, Entry/Contract checkout, public promo codes and the Live Sub-only reminder configuration remain intact.
