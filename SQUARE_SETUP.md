# Square payment setup

This branch adds two separate Square-hosted checkouts to the existing application. It does not activate live payments by itself. Prices are read server-side from the published academy settings: entry £85 / £125; contract £100 / £250 / £750 / £5,000. All are one-off payments.

## 1. Deploy for sandbox testing

Merge/deploy this branch to a Vercel preview environment or a separate staging project. Use a separate staging database for sandbox testing: test applications and signed snapshots are still saved even though payment records are isolated by Square environment. Keep public production payment variables unset until ready. This is the existing Vercel project, not Sites hosting.

In Square Developer Console, create/select the application and switch to Sandbox. Add these server-only variables in Vercel Settings → Environment Variables for the selected testing deployment:

| Variable | Value |
| --- | --- |
| SQUARE_ENVIRONMENT | sandbox |
| SQUARE_ACCESS_TOKEN | Sandbox access token |
| SQUARE_LOCATION_ID | Sandbox seller location ID |
| SQUARE_SITE_URL | Exact HTTPS testing origin, without a path |
| SQUARE_WEBHOOK_URL | Exact testing origin followed by `/api/education/payments/webhook` |
| SQUARE_WEBHOOK_SIGNATURE_KEY | Signature key for the Sandbox webhook subscription below |

Create the Sandbox webhook subscription using that exact URL. Subscribe to `payment.created`, `payment.updated`, `refund.created`, and `refund.updated`. The raw notification body and configured notification URL are verified against Square's signature. Redeploy after setting variables. No Application ID is required because checkout is hosted by Square.

The webhook URL must be publicly reachable by Square, without Vercel Deployment Protection or a login wall. Use a dedicated public staging domain if the preview deployment is protected. Do not put access tokens or webhook signature keys in GitHub, browser code, screenshots or chat.

## 2. Test the complete journey

1. Open the application in a new browser session. Select a path and entry tier.
2. Continue after the introduction and click Pay. The modal must show “Sandbox test · No real payment.”
3. Complete Square's sandbox checkout. Return to the application; the server queries Square before marking the entry paid. Use “Check payment status” if needed.
4. Complete the questions, enter name/email, select a contract, scroll through the agreement and sign.
5. Continue to the separate contract checkout and complete the sandbox payment.
6. Verify the confirmation and expiry date. Check the Applications dashboard for entry and contract statuses.
7. Use the existing administrator action to issue a chat access code. Payment does not automatically approve an application or send an access code. Verify the code and private chat in a second browser.
8. Retry checkout, revisit the return URL before paying, and refresh after a completed payment. Verify that no duplicate checkout is created.
9. Refund the sandbox payment in Square and check that the webhook marks it `refund_review` and stops the paid student's private access.
10. Check the Square webhook delivery log. A successful signature alone does not grant access: the backend retrieves the current payment and validates location, order, amount, and GBP currency.

Local tests use mocked Square HTTP responses and PostgreSQL-compatible PGlite. They do not replace this real Square sandbox acceptance test.

## 3. Review the published agreement before production

The current repository defaults contain an educational draft agreement saying payment is not connected. The owner must replace and publish final agreement text before enabling real checkout. Confirm the service description, the entry fee's purpose, whether admission is guaranteed, refund rules, 24-hour scope, and what unlimited access includes. Keep the real service accurately described to Square. Confirm the account is approved for the actual services being sold as well as identity verification.

Access periods begin at Square's payment completion time, not when an administrator issues a code. A month means a UTC calendar month, clamped to the last valid day; three months follows the same rule. Unlimited means no scheduled expiry. There is no auto-renewal. Existing admin-approved users with no payment record retain existing access.

The public course preview remains public. This integration gates application submission, admin code issuance for payment-linked students, private chat/media authentication and saved lesson progress. It does not turn the existing publicly bundled course content into a protected learning-management system.

## 4. Enable production after approval

Use the production Vercel environment and real database. Replace the sandbox values with production credentials and set:

- `SQUARE_ENVIRONMENT=production`
- `SQUARE_LIVE_ENABLED=true`
- `SQUARE_SITE_URL=https://goddessvanessa.vercel.app`
- `SQUARE_WEBHOOK_URL=https://goddessvanessa.vercel.app/api/education/payments/webhook`

Create a separate Production webhook subscription with the four events above and store its production signature key. Redeploy, perform a controlled live purchase, verify both Square and academy records, and verify any refund in both systems. A custom-domain switch requires updating the site URL and webhook URL/subscription together. Existing checkout return URLs retain the origin used when created.

## Operational behaviour and limitations

- Card details are collected by Square; the academy stores only checkout/payment references and statuses.
- One checkout per applicant, environment and payment stage. Retries reuse the stored request and idempotency key. The selected plan is locked once checkout starts; changing it, renewing, or buying another period requires a future administrator workflow. Do not manually delete pending records while their Square links remain payable.
- Signed agreement snapshots remain immutable. Once contract checkout exists, the application cannot silently replace that signed agreement.
- Payment confirmations are displayed on-site with a Square receipt link where provided. Automatic academy payment-confirmation emails are not added; existing access-code email delivery remains unchanged.
- Webhooks reconcile against the current Square payment. Duplicate events do not extend access. Any refunded amount triggers review and suspends payment-linked access. Refund decisions remain in Square Dashboard. Dispute-specific workflows and scheduled reconciliation are not implemented; monitor Square and webhook delivery logs.
- The user can reconcile a delayed notification with “Check payment status.” Keep the originating browser session; this does not add a cross-device application recovery system.
- `SQUARE_ENVIRONMENT` unset preserves the existing preview flow. Once a valid mode is selected, missing credentials fail closed for checkout and new payment-dependent submissions.
- Payment records use existing private `academy.prototype_settings` storage; no schema migration, public table, secret exposure, or Supabase access-policy change is required. Records include user linkage, original agreed price/request, Square references, timestamps, and receipt URL. Public endpoints return only the requesting applicant's payment summary.

## Verification

Run `npm ci`, `npm run build`, and `npm test` under Node 24. `scripts/check-square.mjs` tests server prices, stage gating, duplicate attempts, ownership, sandbox/production separation, signature rejection, mismatched amounts, status reconciliation, refunds and calendar expiry.
