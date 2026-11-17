# Buks Shot It

Website and business platform for Buks Shot It (wedding, portrait, event and product photography).

| Folder | Contents |
| --- | --- |
| `src/` | Next.js 16 website (App Router, TypeScript, Tailwind CSS 4) |
| `src/content/` | Approved copy, prices and the image registry |
| `supabase/` | Database schema, security rules and tests |
| `tests/e2e/` | Browser checks: accessibility, links, forms, layout |
| `brand/` | Logo files, design tokens, brand guidelines, mockups |
| `design/` | Approved design prototype source |

## Run locally

```bash
npm install
npm run dev
```

## Checks

```bash
npm run typecheck
npm run lint
npm run build
npm run test:site     # needs a running site: BASE=http://localhost:3000, and Playwright installed
npm run test:db       # needs a local PostgreSQL superuser (see supabase/README.md)
npx vitest run        # storage tests; needs an S3 test server: moto_server -p 5005
```

## Preview and production

- `NEXT_PUBLIC_SITE_STAGE` unset: preview build. Shows a preview banner and visible placeholders, and is hidden from search engines.
- `NEXT_PUBLIC_SITE_STAGE=production`: launch build. **The build fails if any `[Placeholder]` is still on a page.**
- `NEXT_PUBLIC_SITE_URL`: the live domain, used for canonical links and the sitemap.

Temporary stock images are listed in `src/assets/temp/CREDITS.md` and must be replaced before launch.

## Admin and photo storage (Deliverable 8)

The admin area lives at `/admin`. Sign-in needs a password **and** an authenticator-app code, and the account must be marked as admin in the database.

Environment variables (set in Vercel → Settings → Environment Variables; secrets never go in code):

| Variable | What it is |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project (public values) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret. Used only by the storage clean-up job |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Secret. R2 API token with read and write access to both buckets |
| `R2_PUBLIC_BUCKET` | Bucket for web-sized portfolio images, with a public custom domain |
| `R2_PRIVATE_BUCKET` | Bucket for originals and client files. Never public |
| `R2_PUBLIC_BASE_URL` | The public bucket's address, e.g. `https://images.example.com` |
| `CRON_SECRET` | Secret. Protects the nightly clean-up of deleted files |
| `STRIPE_SECRET_KEY` | Secret. Stripe API key (use the test key `sk_test_…` until launch) |
| `STRIPE_WEBHOOK_SECRET` | Secret. Signing secret of the Stripe webhook endpoint (`whsec_…`) |
| `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile spam check on the contact and booking forms (both needed; the widget appears only when both are set) |

Photographs go straight from the browser to the private bucket, so that bucket needs a CORS rule allowing `PUT` from the site's domain with the `Content-Type` header. The server then makes the web sizes (EXIF and GPS removed) and stores them in the public bucket.

Making the first admin: create the user in Supabase → Authentication, then run `insert into public.profiles (id, role) values ('<user id>', 'admin') on conflict (id) do update set role = 'admin';` in the SQL editor. They set up the authenticator app on first sign-in.

## Booking (Deliverable 9)

Visitors choose a package, a date and a start time on `/book`; the request is checked again by the database (`request_booking`), which refuses times that overlap a session (including the 60-minute gap), full or blocked dates, and anything with less than 24 hours' notice. Requests don't hold the date: approving one (admin → Bookings) holds it for 72 hours while the client pays the retainer (payments arrive in Deliverable 10).

Booking hours, start-time steps and notice are in the `settings` table. Defaults, to be confirmed by the client: 7:00 to midnight Eastern Time, start times every 30 minutes, 24 hours' notice; product sessions are 2 hours. Portrait sessions stay enquiries until their prices are supplied.

Until Supabase is connected, `/book` runs in preview mode: it shows the flow with the default hours and never reports a request as sent.

## Payments (Deliverable 10)

Approving a request emails the client a private payment link (`/pay/<token>`; only a hash of the token is stored). The page offers the 35% retainer or payment in full; once confirmed, it offers the balance. Amounts always come from the database. Payment happens on Stripe Checkout, so card details never touch this site.

Stripe setup:
1. Create the Stripe account in the business's name and add `STRIPE_SECRET_KEY`.
2. In Stripe → Developers → Webhooks, add the endpoint `https://<your domain>/api/stripe/webhook` with the events `checkout.session.completed` and `checkout.session.async_payment_succeeded`, then add its signing secret as `STRIPE_WEBHOOK_SECRET`.
3. `SUPABASE_SERVICE_ROLE_KEY` must be set (the webhook records payments with it).

A payment is recorded only from a webhook whose Stripe signature checks out; repeated deliveries are ignored. Payments made another way (cash, Zelle, bank transfer) are recorded from the booking page in the admin area. Refunds are not automated; the retainer is non-refundable under the booking terms, which still need legal review.
