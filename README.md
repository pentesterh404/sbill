# SplitBill Backend (Telegram + VietQR)

Production-ready TypeScript backend for Telegram group bill splitting with VietQR payment links.

## Stack
- Node.js + TypeScript
- Express (webhook HTTP)
- PostgreSQL + Prisma
- Node `crypto` for HMAC tokens

## Environment Variables
Copy `.env.example` to `.env` and configure:

- `DATABASE_URL`: PostgreSQL connection string
- `PORT`: HTTP port (default `3000`)
- `TELEGRAM_BOT_TOKEN`: Telegram bot token
- `TELEGRAM_WEBHOOK_SECRET`: Secret token to validate Telegram webhook header
- `APP_BASE_URL`: Public base URL for pay links (e.g. `https://your-domain.com`)
- `SERVER_SECRET`: Long random secret (>=32 chars) for HMAC
- `ADMIN_DASHBOARD_KEY`: Secret key for manual payment admin dashboard
- `PAY_TOKEN_TTL_SECONDS`: Pay token lifetime (seconds)
- `VIETQR_BANK_CODE`: VietQR/NAPAS bank code
- `VIETQR_ACCOUNT_NUMBER`: Receiver account number
- `VIETQR_ACCOUNT_NAME`: Receiver account name

## Install and Run
```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

## Admin Desktop App
```bash
cd desktop-admin
npm install
npm start
```

- Enter backend base URL (for example: `http://localhost:3000` or production domain).
- Enter `ADMIN_DASHBOARD_KEY`.
- App opens `/admin` and sends `x-admin-key` header automatically for admin routes.

Build Windows `.exe`:
```bash
cd desktop-admin
npm install
npm run build:win
```

Output installer: `desktop-admin/release/*.exe`

## Database Connection Test
```bash
npm run test:db
```

## Telegram Webhook
Set webhook to:

`POST https://<your-domain>/telegram/webhook`

Example:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-domain.com/telegram/webhook","secret_token":"<TELEGRAM_WEBHOOK_SECRET>"}'
```

## Commands
- `/s <total_amount> <num_people> <note?>`
  - Creates OPEN bill in the group
  - `per_person = ceil(total_amount / num_people)`
- `/p`
  - Registers caller to latest OPEN bill in that group
  - Replies directly in group (as a reply to `/p`) with payment link

## Endpoints
- `POST /telegram/webhook`
- `GET /pay/:token`
- `GET /health`
- `GET /admin?key=<ADMIN_DASHBOARD_KEY>`
- `POST /admin/participants/:participantId/confirm`
- `POST /admin/bills/:billId/confirm-all`
- `POST /admin/bills/:billId/cancel`

## Admin Dashboard (Manual Confirm)
- Open: `https://<your-domain>/admin?key=<ADMIN_DASHBOARD_KEY>`
- Confirm payment manually by clicking `Confirm PAID` for a participant.
- Confirm all unpaid participants in a bill by clicking `Confirm All PAID`.
- Cancel a wrong bill by clicking `Cancel Bill` (no Telegram bot command needed).
- When all participants are `PAID`, bill is auto-marked `CLOSED`.

## Vercel Deploy
- This repo includes `vercel.json` + `api/index.ts` for serverless runtime.
- `src/index.ts` is local-only entrypoint (for `npm run dev`).
- Required Vercel env vars:
  - `DATABASE_URL`
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_WEBHOOK_SECRET`
  - `APP_BASE_URL`
  - `SERVER_SECRET`
  - `ADMIN_DASHBOARD_KEY`
  - `PAY_TOKEN_TTL_SECONDS`
  - `VIETQR_BANK_CODE`
  - `VIETQR_ACCOUNT_NUMBER`
  - `VIETQR_ACCOUNT_NAME`
- Framework preset: `Other`
- After deploy, set webhook to:
  - `https://<your-vercel-domain>/telegram/webhook`

## Architecture
- Webhook handler: `src/routes/telegram.route.ts`
- Bill service: `src/services/bill.service.ts`
- Participant service: `src/services/participant.service.ts`
- VietQR generator: `src/services/vietqr.service.ts`

## Security Notes
- Identity is taken only from Telegram update payload (`message.from` / `callback_query.from`)
- Amount is fixed server-side from bill data
- Pay token is HMAC-SHA256 over `bill_id + telegram_id`
- Token is stored server-side with expiry
- One participant per bill (`@@unique([bill_id, telegram_id])`)
- Duplicate `/p` returns existing participant link
- Clean API errors (no stack traces in responses)
