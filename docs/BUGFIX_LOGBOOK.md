# Bug-fix logbook

Record confirmed incidents and fixes here, newest first. Dates use Europe/Warsaw. Keep client names, email addresses, card data, tokens, access codes and raw recordings out of this file. Distinguish observed evidence from inferred causes. A deployment alone does not prove a live issue is resolved.

## BUG-2026-10-03-002 — Mobile conversation layout and attachment recovery

- **Reported:** 3 October 2026, from a live client test with screenshots and a recording.
- **Status:** Patched; automated validation completed; awaiting confirmation on the reporting phone.
- **Affected areas:** Sub chat header, account menu, mobile keyboard, file selection and attachment upload; shared upload quota check also affects Goddess uploads.
- **Evidence:** Name overlaps action icons, dropdown extends beyond the left edge, keyboard leaves recent messages outside the visible screen, native file selection opens Workspace, and a small screenshot is rejected as exceeding the 1 GB allowance. Aggregate live storage was approximately 5.4 MB; no personal record content was required for diagnosis.
- **Confirmed causes:** An inherited mobile `flex-basis:100%` squeezed the chat identity beside its action buttons; the menu was anchored to that misplaced action group. Visibility changes from the native file picker invoked the same privacy cover as leaving the tab. PostgreSQL `SUM(bigint)` returns a numeric string, and adding upload bytes concatenated that string instead of adding numbers. Keyboard clipping is consistent with a layout viewport that does not follow the visual viewport; physical-device confirmation remains required.
- **Patch:** Give header identity and action controls explicit flex sizing; bound the account dropdown; follow visual viewport height and offset, preserve reading position and keep the latest conversation visible when composing; return automatically only after picker change/cancel confirms completion of a picker-induced cover. Manual Workspace and ordinary tab-switch covers persist. Keep a visible explicit Send file control. Convert and validate aggregate bytes numerically before enforcing quota.
- **Validation:** Targeted picker/privacy, keyboard viewport, scroll retention, upload completion and idempotent retry checks; genuine full quota rejection. Full regression suite and build passed; production dependency audit reported zero known vulnerabilities. Deployed assets and private chat/upload/media endpoints verified on both hosts; unauthenticated requests rejected with private no-store responses, strict chat headers preserved, and bank authentication CSP remains isolated to checkout.
- **Deployments:** Live `15baad056b36bc62819cf08a2e8e45ca91e88bd0`; sandbox `746163b6eb35b86a8f3d73a786dcf7cf4d0fb116`. Both Vercel deployments reported success.
- **Record handling:** No client messages, files, contracts, access codes or payment records changed. Regression upload records exist only in disposable local test databases. Raw client recordings are excluded from the repository.
- **Limitations:** Automated visual-viewport tests do not emulate an actual iOS/Android keyboard or native picker. The client should refresh the chat and repeat typing, menu and file selection on their phone. No claim of absolute security.

## BUG-2026-10-03-001 — Discount and contract checkout recovery

- **Reported:** 3 October 2026, during a live client test.
- **Status:** Resolved — user confirmed the live retry worked on 3 October 2026 at 20:27 Europe/Warsaw.
- **Affected areas:** Application entry checkout, SUB50 discount, contract payment and bank authentication.
- **Symptoms:** Contract checkout remained on “Confirming your payment”; the report also described a discount failure.
- **Evidence:** Live records showed entry paid at £42.50 with SUB50 and a signed 3-month contract at £375. No contract charge attempt was recorded by the server during the failed test. The discount had applied to this client's saved prices.
- **Likely cause of the stall:** Checkout CSP restricted external bank-authentication form submissions and frames used by Square. The exact browser violation from the client's device was not captured. Separately, opening an untouched checkout froze its price and hid the promo input.
- **Patch:** Permit HTTPS bank-authentication forms and frames only on application checkout, retain restricted script sources and other page policies; allow SUB50 to reprice an untouched embedded entry checkout; preserve paid and uncertain attempts; add verification timeout/reopen controls and bounded charge requests with the same attempt identity for safe retries.
- **Validation:** Targeted promo, timeout, late-token, policy-block and CSP isolation checks; full security regression suite; successful build; production dependency audit with zero known vulnerabilities; deployed private endpoint and header checks on both sites. Square sandbox API entry (£42.50), signed contract (£375) and repeat confirmation succeeded. User subsequently confirmed the live retry worked. The sandbox API test did not exercise a browser bank challenge.
- **Deployments:** Live main commit `b63f99922fdd5af28034f1ed57de2862bafbc59f`; sandbox commit `d1b103d9336f10cedb0554570b0e7d18b7535244`.
- **Record handling:** Existing live payment and agreement records were preserved. Routine testing used synthetic sandbox records and did not charge real money.
- **Prevention:** Keep regression coverage for discounts after checkout preparation, immutable paid/uncertain attempts, issuer authentication policy scope, verification timeouts and duplicate-charge prevention.

## Entry template

- **ID / title:** BUG-YYYY-MM-DD-NNN — concise description.
- **Reported / status / affected areas:** Date, open or resolved, and impacted flow.
- **Symptoms / evidence / cause:** What failed, what was observed, and whether the cause is confirmed or inferred.
- **Patch / validation:** Final changes, exact checks performed, and any remaining limitations.
- **Deployments / record handling:** Live and sandbox commits; any data changes or real transactions.
- **Prevention / confirmation:** Regression coverage and who confirmed resolution, with date.
