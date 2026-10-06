# Sandbox feed card donations — release 2026.10.06.9

Subs can now use Square card fields in the donation popup, with the same Retry and Success components as application checkout. A delayed confirmation keeps the original payment attempt. Declines clear the fields for a fresh attempt. Existing hosted checkouts retain their original order and payment link. A donation does not change the contract.

## Verification

The full regression suite, zero-vulnerability production dependency audit and 115-asset build were run. Targeted checks cover Sub/owner boundaries, CSRF, server price snapshots, wrong amounts, pending checkout reuse across tabs, card declines, unknown confirmation, same-payment retries, token disposal, cross-Sub privacy and queued modal close events.

Browser verification used actual Square Sandbox SDK fields/tokenization, public Sandbox card values, disposable local data and a fake provider transport. No actual Square payment was made. Mobile 390×844 and desktop 1280×900 day/night layouts, validation errors, card decline, confirmation Retry, Success and returning to the feed were verified with no browser warning/error logs. The hosted Sandbox deployment passed 155 checks: 145 primary checks including 115 exact assets, plus 10 card-specific authorization/CSP/readiness checks. Code commit 23c421007c3fdc15498b4a9515515b5048c74aab, deployment dpl_6RmgCuLZeLe9jxpXVb5BJupuACUE, READY on the Sandbox alias. A live bank-app/3DS challenge was not exercised; the existing timing and cancellation behavior is covered by regression tests.

## Security boundaries

Only Square’s single-use card token reaches the server; raw card fields and browser prices are rejected. Stored attempts are private, actor-scoped and provider-idempotent. Confirmed donation tokens are removed. Square’s authoritative amount, GBP currency, location and order are required before payment is reported successful. Bank frame/form CSP permissions apply to application/feed routes; local and Square script allowlists remain restricted.

Supabase private payment storage remains RLS-enabled with no anon/authenticated SELECT grants. No schema, environment, authentication setting, real customer record or Live deployment changed. Existing private-table RLS/no-policy INFO notices and the [leaked-password-protection advisory](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remain. This verification is not a claim of immunity from every vulnerability.

## Provider references

- [Square card payments and buyer verification](https://developer.squareup.com/docs/web-payments/take-card-payment)
- [Square payment CSP](https://developer.squareup.com/docs/web-payments/content-security-policy)
- [Square card form styles](https://developer.squareup.com/docs/web-payments/customize-styles)
