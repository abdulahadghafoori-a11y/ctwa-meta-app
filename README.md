# CTWA + Meta CAPI (Next.js 15)

Production-oriented app for storing Click-to-WhatsApp (YCloud) sessions, recording orders in **Neon Postgres** via **Drizzle**, and sending **Purchase** events to **Meta Conversions API** (Graph) from a Server Action.

## Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) database
- Meta **Pixel ID**, **Access Token** with Conversions API permissions, and (optionally) a **Test Event Code**

## Setup

1. **Install dependencies**

   ```bash
   cd ctwa-meta-app
   npm install
   ```

2. **Environment**

   Copy `.env.example` to `.env.local` and set:

   - `DATABASE_URL` — Neon connection string (pooled URL is fine for serverless).
   - `META_ACCESS_TOKEN` — from Meta Business / System User.
   - `META_PIXEL_ID` — the Pixel (dataset) used in Events Manager.
   - Optional: `META_TEST_EVENT_CODE` — for Test Events in Events Manager.
   - Optional: `YCLOUD_WEBHOOK_SECRET` — signing secret from [YCloud Webhooks](https://docs.ycloud.com/reference/configure-webhooks); if set, `POST /api/webhooks/ycloud` requires a valid `YCloud-Signature` header.

3. **Database schema**

   ```bash
   npx drizzle-kit migrate
   ```

   For a quick dev sync without migration files, you can use `npm run db:push` (use migrations for production).

4. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## GitHub

1. Create a new **empty** repository on [github.com/new](https://github.com/new) (no README/license; name e.g. `ctwa-meta-app`).
2. From this project folder:

   ```bash
   git add -A
   git commit -m "Initial commit: CTWA orders, YCloud webhooks, Meta CAPI"
   git branch -M main
   git remote add origin https://github.com/<YOUR_USER>/<YOUR_REPO>.git
   git push -u origin main
   ```

   Use **SSH** instead if you prefer: `git remote add origin git@github.com:<YOUR_USER>/<YOUR_REPO>.git`

## Vercel

1. Sign in at [vercel.com](https://vercel.com) and **Add New… → Project**.
2. **Import** the GitHub repository you just pushed (install the GitHub app if prompted).
3. **Framework:** Next.js (auto). **Root directory:** `./` (default). **Build:** `npm run build`, **Output:** Next default.
4. **Environment variables** — add the same keys as `.env.example` for **Production** (and Preview if you want previews to hit a DB):

   | Variable | Notes |
   |----------|--------|
   | `DATABASE_URL` | Neon pooled string (use a Neon *production* branch/database for prod). |
   | `META_ACCESS_TOKEN` | Meta system user token. |
   | `META_PIXEL_ID` | Pixel / dataset id. |
   | `META_TEST_EVENT_CODE` | Optional — Test Events. |
   | `YCLOUD_WEBHOOK_SECRET` | From YCloud Webhook endpoint (required if you enforce signatures). |

5. **Deploy.** After the first deploy, run migrations against the **production** database (from your machine with prod `DATABASE_URL`, or a one-off CI job):

   ```bash
   npm run db:migrate
   ```

6. **YCloud webhooks:** Set the endpoint URL to `https://<your-vercel-domain>/api/webhooks/ycloud` (see [YCloud webhooks](#ycloud-webhooks) below).

## Routes

| Path | Purpose |
|------|---------|
| `/` | Recent orders (dashboard) |
| `/orders/new` | Create order + send CAPI Purchase |
| `/products` | Product list + create |
| `POST /api/webhooks/ycloud` | YCloud webhooks → `contacts` + `ctwa_sessions` |

### YCloud webhooks

1. In [YCloud Console](https://www.ycloud.com/console/) go to **Developers → Webhooks** → **Add endpoint** ([docs](https://docs.ycloud.com/reference/configure-webhooks)).
2. **URL:** `https://<your-production-domain>/api/webhooks/ycloud` (must be public HTTPS; use [ngrok](https://ngrok.com/) or similar for local testing: `https://<tunnel>.ngrok-free.app/api/webhooks/ycloud`).
3. Subscribe at minimum to:
   - `whatsapp.inbound_message.received` — stores CTWA rows when `referral.ctwa_clid` is present.
   - `contact.created` — upserts contacts (name, country, etc.).
4. Copy the endpoint **signing secret** into `YCLOUD_WEBHOOK_SECRET` in Vercel (or `.env.local`). Without the secret, the route accepts any POST (fine for dev only).

## YCloud → Meta

- This repo sends **Graph API** `/{pixel-id}/events` from `lib/meta-capi.ts`.
- **Alternative:** route events through **YCloud Custom Event / forwarding** so YCloud calls Meta and this app only stores orders — see comments in `lib/meta-capi.ts` and the webhook route.

## shadcn/ui

Components live under `components/ui`. Add more with:

```bash
npx shadcn@latest add <component>
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run db:generate` | Generate SQL migrations from `drizzle/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:push` | Push schema (dev convenience) |
| `npm run db:studio` | Drizzle Studio |
