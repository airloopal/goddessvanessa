# Sandbox staff workspace — 24 October 2026

Open `/staff.html` on the square-sandbox deployment. Goddess can also use Account → Team & social studio, or the Staff workspace card in Settings. Staff use the same `/staff.html` address with their individual email and password. Goddess uses her existing login.

## First use

1. Goddess opens Team & assignments and chooses Add staff member.
2. Choose Chatter or Social media manager. Copy the one-time temporary password and share it privately with that person. Creating an account sends no email.
3. Staff must replace the temporary password before accessing workspace data. Passwords are salted scrypt hashes; raw passwords and session tokens are never stored in the database.
4. Assign each conversation to one active chatter. An unassigned conversation remains Goddess-only. Goddess retains access to all conversations.
5. Disable access to invalidate every existing staff session immediately. Re-enabling does not resurrect previous sessions. Reset password also invalidates existing sessions.

## Included

- Chatter: assigned conversation history, text replies with safe retry, earlier-message pagination, shared photo/video/voice-note/document playback, private team notes and handover, and Contact Goddess / Report a bug threads.
- Goddess: staff management, assignments, all workspace conversations, support replies/status, draft approval/feedback and a private activity log. Staff authorship is recorded against each reply; existing Sub-facing sender branding is preserved.
- Social manager: own drafts, separate Instagram/TikTok captions, target publication time, private public-content media uploads, up to six ordered assets, carousel previews, native video controls and submission for approval.
- Approved drafts are locked to staff. Goddess can request changes; edits require another review. Approval checks the exact saved revision, so a stale approval cannot approve unseen edits.
- Existing Goddess notifications include a team support / approval summary linking to the workspace.
- Responsive mobile/desktop layouts, light/dark themes, native dialog close/Escape behavior and reduced-motion support.

## Boundaries

This is a Sandbox-only first release. The API refuses non-Preview environments. No Live branch, hosted Live settings or credentials were changed.

Staff never receive Goddess identity headers and cannot use the owner APIs. Chatters cannot issue access codes, change contracts, confirm payments, broadcast, change account status or inspect unrelated conversations. Social staff cannot access private Sub chats, profiles, chat attachments or financial records. The studio has its own media metadata and object prefix; private chat assets cannot be attached to social drafts.

This initial staff composer sends text replies and plays existing shared media. Sending new chat media and voice recording from staff accounts are not part of this release. Staff accounts use individual passwords and eight-hour sessions; staff authenticator/MFA enrolment is not included. Goddess's existing MFA remains unchanged. Signed media links already issued expire within five minutes; downloaded material cannot be recalled.

Social publishing and automatic scheduling are not connected. The target date is a planning field, and approval does not publish a post. Instagram/TikTok connections require separate work; TikTok internal-tool restrictions remain relevant. Controlled email testing remains Sandbox-only and was not changed or exercised here.

Studio upload formats: JPG, PNG, WebP, MP4 and WebM, up to 50 MB each. This first release reserves a conservative 2 GB studio allowance including pending uploads. No external customer media or real social accounts were used for testing. Library asset deletion and automatic orphan cleanup are not exposed in this first release; support/admin maintenance is needed if that allowance fills. Existing chat compression and Stream quotas are unchanged.

## Verification

`scripts/check-staff.mjs` uses synthetic local PostgreSQL records and tests authentication, roles, forged identities, forced initial password changes, hashing/cookies, brute-force limits, account disable/reset/expiry, reassignment, stale writes, idempotent replies, read receipts, paused conversations, private shared media, support ownership, draft/approval revision conflicts, approved-content locks, media separation, size/MIME limits and upload-retry recovery. The complete existing regression suite also passes. Production dependency audit reports zero vulnerabilities; build includes 137 assets.

Browser verification uses an isolated local synthetic database and test media, with mobile 390×844 and desktop layouts. This does not certify physical iPhone keyboard/audio behavior or third-party publishing. Hosted anonymous/forged-request and deployed-asset checks are recorded in the logbook after release. No customer messages, real payments, emails or social posts were sent; no actual staff accounts were provisioned during verification.
