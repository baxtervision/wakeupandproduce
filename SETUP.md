# Paywall Setup Guide — Wake Up & Produce

## Architecture

```
Coach visits protected page
  → Cloudflare Access intercepts
  → Email OTP login prompt (no account required)
  → Access Evaluator Worker checks KV: is this email paid?
  → YES: serve page  |  NO: redirect to /access/

On purchase:
  Zoho Payments Checkout → webhook fires → Webhook Worker writes email to KV

Free (no gate):  Key Actions, Key Terms
Paid (gated):    Offense, Defense, Grinnell Tracker, Learning, Recruiting
```

---

## Step 1 — Zoho Payments Setup

1. Go to https://payments.zoho.com (or your regional Zoho Payments dashboard)
2. Create a **Payment Link**
   - Product name: "Wake Up & Produce — Full Access"
   - Amount: $29 one-time
   - Redirect / Success URL: `https://wakeupandproduce.com/access/thank-you/`
3. Copy the Payment Link URL and paste it into `access/index.html`,
   replacing `https://payments.zoho.com/YOUR_PAYMENT_LINK`
4. Go to Settings > Webhooks > Add Webhook
   - URL: `https://wakeupandproduce.com/api/zoho-webhook`
   - Events: `payment.captured`, `payment.failed`
5. Copy the **Signing Secret** — needed in Step 3

> **Note:** After deploying the webhook worker (Step 3), trigger a test payment
> and inspect Cloudflare Worker logs to confirm the payload field names match
> those in `workers/zoho-webhook.js`. Adjust `extractEmail()` if needed.

---

## Step 2 — Cloudflare KV Namespace

1. Cloudflare Dashboard > Workers & Pages > KV
2. Create namespace: `PAID_USERS`
3. Note the namespace ID — you'll bind it to both workers

---

## Step 3 — Deploy the Webhook Worker

1. Cloudflare Dashboard > Workers & Pages > Create Worker
2. Name it: `zoho-webhook`
3. Paste the contents of `workers/zoho-webhook.js`
4. Settings > Variables > KV Namespace Bindings:
   - Variable name: `PAID_USERS` → select your namespace
5. Settings > Variables > Environment Variables > Add (Encrypt):
   - `ZOHO_WEBHOOK_SECRET` = your Zoho Payments signing secret from Step 1
6. Settings > Triggers > Add Route:
   - `wakeupandproduce.com/api/zoho-webhook*` → this worker

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
   - `wakeupandproduce.com/offense-guide`
   - `wakeupandproduce.com/defense-guide`
   - `wakeupandproduce.com/grinnell-tracker`
   - `wakeupandproduce.com/learning`
   - `wakeupandproduce.com/recruiting`

   **Leave unprotected (free):**
   - `wakeupandproduce.com/offensive-key-actions`
   - `wakeupandproduce.com/key-terms`

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

1. Visit `/offense-guide/` — should prompt for email (now a paid page)
2. Visit `/offensive-key-actions/` — should load freely (no prompt)
3. Visit `/key-terms/` — should load freely (no prompt)
4. Enter an email NOT in KV on a paid page — should get the deny message
5. Manually add a test email to KV:
   - Cloudflare dashboard > KV > PAID_USERS > Add entry
   - Key: `test@youremail.com`
   - Value: `{"paid_at":"2026-01-01","mode":"test"}`
6. Visit a protected page again with that email — should pass through
7. Run a Zoho Payments test payment and check Cloudflare Worker logs to
   confirm the webhook received the event and wrote the email to KV

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

$29 one-time lifetime access. The Zoho webhook grants access on `payment.captured`
and does not expire automatically — use the admin panel to revoke if needed.

If you bundle with pocketcoach.training later, the pocketcoach webhook can write
to the same `PAID_USERS` namespace, granting cross-site access automatically.
