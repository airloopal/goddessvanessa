# Platform health check — 24 October 2026

## Action needed: Vercel hosting plan

The Vercel team is on Hobby. Its selected last-30-days window (23 September–23 October as displayed) reports:

| Resource | Observed | Included | Position |
| --- | ---: | ---: | --- |
| Active CPU | 4h 18m | 4h | About 108%; above allowance |
| CDN requests | About 842,000 | 1,000,000 | About 84%; watch closely |
| Function invocations | 659,274 | 1,000,000 | About 66% |
| Provisioned memory | 183.6 GB-hours | 360 GB-hours | About 51% |
| Fast data transfer | 5.74 GB | 100 GB | About 6% |
| Fast origin transfer | 3.41 GB | 10 GB | About 34% |
| Throttled function requests | 0 | — | No concurrency throttles shown |
| Build time | 2 hours | 100 hours | About 2% |

The majority of CPU is attributed to goddessvanessa (4h 6m); the team also contains another project. Limits are shared at team level. These are dashboard observations, not a forecast or a guarantee against suspension. Hobby has no normal paid billing cycle; Vercel says exceeded features may be unavailable until the applicable period clears. It also restricts Hobby to personal, non-commercial use. This paid platform should move to Pro. No plan, billing setting, spend limit or credential was changed.

Sources: [Vercel team usage](https://vercel.com/system-admin/~/usage), [Hobby allowances and commercial-use restriction](https://vercel.com/docs/plans/hobby).

## Supabase: within Pro allowances

The organization is confirmed on Pro. Current billing cycle displayed: 9 October–9 November 2026. Dashboard reports no exceeded quota.

| Resource | Used | Included |
| --- | ---: | ---: |
| Uncached egress | 15.498 GB | 250 GB (about 6%) |
| Cached egress | 5.16 GB | 250 GB (about 2%) |
| Average file storage in period | 0.584 GB | 100 GB (below 1%) |
| Realtime peak connections | 0 | 500 |
| Realtime messages | 0 | 5,000,000 |
| Edge Function invocations | 0 | 2,000,000 |

Supabase Auth MAU counters do not represent the app’s custom Sub sessions. Actual database inspection: ACTIVE_HEALTHY; about 48.5 MB database, 2 GB provisioned disk in the dashboard, 16/60 Postgres connections at the sampled moment, one active query and no lock waiters. Storage buckets are private. Current object inventory totals about 656 MB, which differs from the billing-period average above. Live and Sandbox application schemas deny schema USAGE to anon/authenticated. Data API settings show 0/22 tables exposed. No database, grants, Auth configuration or data was changed.

Security advisor: no WARN/ERROR findings; 22 INFO findings describe deliberately RLS-protected private application tables with no client policies. Performance advisor: four unused indexes and one informational fixed Auth connection allocation notice. No index was removed. The networking extension grants database-login roles access to its queue/response tables, as previously approved; Vault denies anon/authenticated schema usage. Public API exposure of networking/Vault remains an important invariant; no API grants were broadened.

Both one-minute reminder jobs are active. Each recorded 1,440 successful scheduler executions in the preceding 24 hours. Retained HTTP responses sampled were all HTTP 200; queue backlog was zero. Scheduler success/HTTP 200 does not prove every intended email was delivered. Aggregate app diagnostics over seven days contain three bank-verification timeouts (HTTP 408); this is not evidence of settled or missing charges. No payments were reconciled manually or marked paid.

Supabase’s status page currently reports a Management API incident under monitoring. The application database was healthy in our checks. Provider status may change after this snapshot. [Supabase status](https://status.supabase.com/).

[Usage dashboard](https://supabase.com/dashboard/org/vercel_icfg_pp1MjT9pzpX5wMnBngFRdNoP/usage); [security advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Cloudflare Stream: storage safely below capacity

Authenticated API reports four videos using 1.32 of 1,000 storage minutes (about 0.13%). The largest aggregate app reservation for one account is 67.02 seconds, below the configured default 100-minute allowance. No expired unreferenced video drafts were found after checking ordinary chat messages, albums and feed references. No videos were uploaded, played, downloaded or deleted for this inspection.

The account’s delivery-minute totals were not obtained: the documented usage endpoint returned 404. Storage health does not establish delivered-minute billing. Stream deliveries are a separate usage/cost dimension.

## Resend: comfortably within current sending limits

Authenticated Settings → Usage reports Free transactional email: 228/3,000 monthly and 1/100 daily; rate limit 10 requests/second. Domain count 1/3. No emails were sent, customer email contents opened, keys read or billing settings changed during the check. These counters are a point-in-time snapshot. [Resend settings](https://resend.com/settings).

## Release verification and limits of coverage

Both complete npm test suites passed and production dependency audits report zero vulnerabilities. Targeted tests cover donation wallet SCA, exact server-owned amounts, cancelled wallet/no charge, card fallback, same-attempt recovery after a lost reply, cross-account/origin denial, private photo reads, photo URL validation, shared lightbox reuse and focus/close behavior. Final targeted runs follow the final lightbox sizing adjustment. Builds and hosted-release results are recorded in BUGFIX_LOGBOOK.md.

UI uses synthetic local data and a mocked Square SDK to verify compact wallet/card layout and profile expansion on mobile/desktop in light/dark themes. Actual Apple Pay/Google Pay sheets require supported HTTPS devices and enrolled wallets. No real transaction or customer photo was used, and physical-device wallet/Safari certification is not claimed. No blanket claim of immunity to malware, penetration or DDoS is made.
