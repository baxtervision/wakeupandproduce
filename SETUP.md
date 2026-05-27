# Paywall Setup Guide — Wake Up & Produce

## Architecture

```
Coach visits protected page
  → Cloudflare Access intercepts
  → Email OTP login prompt (no account required)
  → Access Evaluator Worker checks KV: is this email paid?
  → YES: serve page  |  NO: redirect to /access/

On purchase:
  Stripe Checkout → webhook fires → Webhook Worker writes email to KV
```

---

## Step 1 — Stripe Setup

1. Go to https://dashboard.stripe.com
2. Create a **Payment Link** (Products > Payment Links > Create)
   - Product name: "Wake Up & Produce — Full Access"
   - Price: $29 one-time
   - Success URL: `https://wakeupandproduce.com/access/thank-you/`
3. Copy the Payment Link URL and paste it into `access/index.html`,
   replacing `https://buy.stripe.com/YOUR_PAYMENT_LINK`
4. Go to Developers > Webhooks > Add endpoint
   - URL: `https://wakeupandproduce.com/api/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.deleted`, `invoice.payment_failed`
5. Copy the **Signing Secret** — needed in Step 3

---

## Step 2 — Cloudflare KV Namespace

1. Cloudflare Dashboard > Workers & Pages > KV
2. Create namespace: `PAID_USERS`
3. Note the namespace ID — you'll bind it to both workers

---

## Step 3 — Deploy the Webhook Worker

1. Cloudflare Dashboard > Workers & Pages > Create Worker
2. Name it: `stripe-webhook`
3. Paste the contents of `workers/stripe-webhook.js`
4. Settings > Variables > KV Namespace Bindings:
   - Variable name: `PAID_USERS` → select your namespace
5. Settings > Variables > Environment Variables > Add (Encrypt):
   - `STRIPE_WEBHOOK_SECRET` = your Stripe signing secret from Step 1
6. Settings > Triggers > Add Route:
   - `wakeupandproduce.com/api/stripe-webhook*` → this worker

---

## Step 4 — Deploy the Access Evaluator Worker

1. Create another Worker, name it: `access-evaluator`
2. Paste the contents of `workers/access-evaluator.js`
3. Add the same KV binding: `PAID_USERS`
4. Add route: `wakeupandproduce.com/api/access-check*` → this worker

---

## Step 5 — Deploy the Grant Access Worker

1. Create another Worker, name it: `grant-access`
2. Paste the contents of `workers/grant-access.js`
3. Add the same KV binding: `PAID_USERS`
4. Add environment variable (encrypted):
   - `ADMIN_TOKEN` = run `openssl rand -hex 32` and copy the output
5. Add route: `wakeupandproduce.com/api/grant-access*` → this worker

---

## Step 6 — Cloudflare Access Configuration

1. Cloudflare Dashboard > Zero Trust > Access > Applications
2. **Create Application:**
   - Type: Self-hosted
   - Name: Wake Up & Produce — Protected Tools
   - Session duration: 720 hours (30 days)
3. **Add protected domains** (one path per line — these are the paid pages):
   - `wakeupandproduce.com/defense-guide`
   - `wakeupandproduce.com/offensive-key-actions`
   - `wakeupandproduce.com/grinnell-tracker`
   - `wakeupandproduce.com/key-terms`
   - `wakeupandproduce.com/learning`

   **Leave unprotected (free):**
   - `wakeupandproduce.com/offense-guide`
   - `wakeupandproduce.com/recruiting`

4. **Login method:** Email OTP (one-time PIN — no account, just email)
5. **Create Policy:**
   - Name: Paid Users
   - Action: Allow
   - Rule: External Evaluation
     - Evaluate URL: `https://wakeupandproduce.com/api/access-check`
     - Keys URL: (leave blank)
6. **Custom Deny Message:**
   "Access requires a Wake Up & Produce purchase. Get access at wakeupandproduce.com/access/"

**Second application — protect the admin panel:**

1. Create another Access Application (Self-hosted)
2. Domain: `wakeupandproduce.com/admin`
3. Session duration: 24 hours
4. Login method: Email OTP
5. Create Policy:
   - Name: Admin Only
   - Action: Allow
   - Rule: Emails — add only your own email address
6. This puts an OTP wall in front of `/admin/` before anyone even sees the token input

---

## Step 7 — Test End-to-End

1. Visit `/defense-guide/` — should prompt for email
2. Enter an email NOT in KV — should get the deny message
3. Manually add a test email to KV:
   - Cloudflare dashboard > KV > PAID_USERS > Add entry
   - Key: `test@youremail.com`
   - Value: `{"paid_at":"2026-01-01","mode":"test"}`
4. Visit a protected page again with that email — should pass through
5. Run a Stripe test payment and verify the webhook writes to KV
   (Stripe dashboard > Webhooks > your endpoint > Send test event)

---

## Step 8 — Admin Panel

Visit `wakeupandproduce.com/admin/` (after Cloudflare Access OTP).
Paste your `ADMIN_TOKEN` to unlock, then:

- **Grant** — enter email + optional note (e.g. "ALSD conference", "promo"), click Grant
- **Revoke** — enter email, click Revoke
- **List** — see all manually-granted accounts with notes and grant dates

Use the note field consistently — six months from now you'll want to know why someone has free access.

**Manual KV grant** (bypasses admin UI, for emergencies):
```
KV key:   their@email.com
KV value: {"paid_at":"2026-01-01","mode":"manual","note":"comp"}
```

---

## Price Point Note

$29 one-time is the current placeholder. The webhook handles both one-time and
subscription modes — `checkout.session.completed` fires for either, and
`customer.subscription.deleted` handles subscription lapse.

If you bundle with pocketcoach.training later, the pocketcoach webhook can write
to the same `PAID_USERS` namespace, granting cross-site access automatically.
