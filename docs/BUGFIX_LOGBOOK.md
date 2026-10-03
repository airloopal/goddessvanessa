# Bug-fix logbook

Record confirmed incidents and fixes here, newest first. Dates use Europe/Warsaw. Keep client names, email addresses, card data, tokens, access codes and raw recordings out of this file. Distinguish observed evidence from inferred causes. A deployment alone does not prove a live issue is resolved.

## BUG-2026-10-04-001 — Bank approval followed by verification timeout

- **Reported:** 4 October 2026, Europe/Warsaw, with a screenshot and repeated live-client failures.
- **Status:** Patched and deployed; automated validation passed; original issuer/device confirmation remains outstanding.
- **Affected areas:** Entry/contract bank authentication, recovery checkout, private status/changelog and browser diagnostic reporting.
- **Evidence:** Screenshot shows the browser's bank-verification timeout before submission. Recent production entry records were pending without recorded server charge attempts; these records cannot independently identify the reporting client. Other recent payments completed. Vercel runtime-log access returned 403, so no issuer callback trace was available.
- **Confirmed implementation defects:** A hard 90-second timer counted time spent outside the browser in a bank app and discarded any later token. Entry checkout used a native modal that makes Square's separate authentication surface outside it inert. Exact contribution of each defect to this client's failure is unconfirmed.
- **Patch:** Count up to 3 minutes of visible authentication time, bounded by a 10-minute total deadline; discard terminal late results. Temporarily yield native modal ownership for Square authentication and restore it after completion without destroying the mounted card. Provide explicit same-tab Square-hosted recovery before waiting or after a verification failure, and return to the application. Server conversion is allowed only before any charge attempt/payment, using revision comparison to exclude concurrent charging; original SUB50 price, signed agreement and entry gates remain authoritative. Existing uncertain attempts retain their original charge identity.
- **Health/changelog:** Updated release history, read-only active GBP Square location check, separate unverified bank-flow status, and rate-limited allowlisted browser reports. Reports are labelled unverified browser evidence and contain no arbitrary error text, card data, source tokens, client identity or URLs. Recent reports trigger an attention state without claiming a provider outage.
- **Validation:** Targeted mobile bank-return timeout, listener cleanup, native modal success/failure handoff, safe hosted conversion, discount integrity, signed contract/entry gates, hosted reconciliation, concurrent fallback/charge exclusion, uncertain payment protection, diagnostic authentication/validation/rate limits and private health redaction. Full regression suite and build passed; production dependency audit found zero known vulnerabilities. Real Square sandbox prepare, discounted hosted fallback, repeated-link idempotence, reload/resume and status reconciliation passed without submitting a payment. Both deployed hosts serve the payment/modal/status patch; unauthenticated recovery, diagnostic, admin health/changelog and chat requests are rejected with no-store responses. Checkout CSP remains restricted.
- **Deployments:** Live main `b00ca642ba9ddb28fd585638433fcf3bb251ec83`; sandbox `811e0bfc053a5306f03327998dcbf15520cce13c`; both deployments succeeded. Health-label and validation follow-up: live `50efc6000ce92e809ab6db32cd716942ffa38905`, sandbox `2b73db42fc69164e0ade5adf61f905ba65d7b002` (both successful).
- **Record handling:** Existing client agreements, payments and pending checkouts preserved; no real money charged in testing. Disposable local PostgreSQL tests use mocked provider responses. One synthetic sandbox application session and pending recovery checkout were created for the real provider check; no contract or charge was submitted. Browser diagnostic records follow the existing 100-record / 7-day retention boundary.
- **Limitations:** No physical phone or original bank challenge replay is possible from the supplied screenshot. Automated issuer-flow simulation is not a confirmed live bank-app round trip. A fresh authorised live test is still needed; customer bank approval alone is not proof of a completed charge.

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
