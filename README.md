# SplitBill Backend (Minimal, No DB)

Minimal backend: Telegram webhook + `/s` command only.

## What It Does
- Receive `POST /telegram/webhook`
- Parse `/s <total_amount> [num_people] [note]`
- Support `k` amount suffix (`10k` => `10000`)
- Default `num_people = 1` when omitted
- Generate VietQR for **per-person amount**
- Reply QR image directly to the Telegram group

## Environment Variables
- `PORT`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET` (recommended)
- `APP_BASE_URL` (used by `scripts/link.sh` to set webhook)
- `VIETQR_BANK_CODE`
- `VIETQR_BANK_NAME` (optional display)
- `VIETQR_ACCOUNT_NUMBER`
- `VIETQR_ACCOUNT_NAME`

## Run
```bash
npm install
npm run dev
```

## Telegram Command
- Legacy: `/s <total_amount> [num_people] [note]`
- New: `/s <bank_code> <account_number> <total_amount> <num_people> [note]`

Examples:
- `/s 10k 4 an_trua`
- `/s 10k an_trua` (auto `num_people = 1`)
- `/s ocb 0912345678 50k 4 an_uong`

Bank alias mapping is loaded from:
- `data/bank_bins.txt`

Example mapping:
- `ocb=970448`

## Set Webhook Quickly
```bash
chmod +x scripts/link.sh
./scripts/link.sh
```

Script reads from `.env` and sets webhook to:
- `<APP_BASE_URL>/telegram/webhook`

## Deploy on Vercel
- Works fine on Vercel (serverless) for this flow because no DB is needed.
- Keep `api/index.ts` and `vercel.json` as currently configured.
- Set required env vars in Vercel project settings.

## Manual Webhook API
```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-domain.com/telegram/webhook","secret_token":"<TELEGRAM_WEBHOOK_SECRET>"}'
```
