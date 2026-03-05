import { Router } from "express";
import { env } from "../config";
import { logError, logInfo } from "../lib/logger";
import { getParticipantByValidToken } from "../services/participant.service";
import { buildVietQrPayload, generateVietQrSvg, sanitizeTransferDescription } from "../services/vietqr.service";

const router = Router();
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const buildCompactPayId = (billId: string, telegramId: string): string => {
  const compactBillId = billId.replace(/-/g, "").slice(0, 16);
  const compactTelegramId = telegramId.length > 6 ? telegramId.slice(-6) : telegramId;
  return `${compactBillId}${compactTelegramId}`;
};

router.get("/:token", async (req, res, next) => {
  try {
    const token = req.params.token;
    logInfo("Pay link requested", { tokenPrefix: token.slice(0, 8) });
    const participant = await getParticipantByValidToken(token);

    if (participant.status === "PAID") {
      logInfo("Pay link opened for already paid participant", {
        participantId: participant.id,
        billId: participant.bill.id,
      });
      res.status(200).type("html").send(`
        <html>
          <body>
            <h1>Payment Received</h1>
            <p>Bill ${participant.bill.id}</p>
            <p>Your payment is already marked as PAID.</p>
          </body>
        </html>
      `);
      return;
    }

    const compactPayId = buildCompactPayId(participant.bill_id, participant.telegram_id);
    const description = sanitizeTransferDescription(`${compactPayId}-${participant.telegram_username}`);
    logInfo("Rendering unpaid QR", {
      participantId: participant.id,
      billId: participant.bill_id,
      amount: participant.amount,
      description,
    });
    const payload = buildVietQrPayload({
      bankCode: env.VIETQR_BANK_CODE,
      accountNumber: env.VIETQR_ACCOUNT_NUMBER,
      accountName: env.VIETQR_ACCOUNT_NAME,
      amount: participant.amount,
      description,
    });
    const qrSvg = await generateVietQrSvg({
      bankCode: env.VIETQR_BANK_CODE,
      accountNumber: env.VIETQR_ACCOUNT_NUMBER,
      accountName: env.VIETQR_ACCOUNT_NAME,
      amount: participant.amount,
      description,
    });
    const escapedPayload = escapeHtml(payload);
    const billId = escapeHtml(participant.bill.id);
    const reference = escapeHtml(description);

    res.status(200).type("html").send(`
      <html>
        <body>
          <h1>Pay Bill</h1>
          <p>Bill: ${billId}</p>
          <p>Amount: ${participant.amount}</p>
          <p>Reference: ${reference}</p>
          <div>${qrSvg}</div>
          <details>
            <summary>Raw VietQR Payload (for debug)</summary>
            <pre>${escapedPayload}</pre>
          </details>
        </body>
      </html>
    `);
  } catch (error) {
    logError("Failed to render pay link", error, { tokenPrefix: req.params.token.slice(0, 8) });
    next(error);
  }
});

export default router;
