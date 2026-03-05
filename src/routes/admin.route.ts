import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { env } from "../config";
import { logError, logInfo } from "../lib/logger";
import { cancelBillById } from "../services/bill.service";
import { confirmAllParticipantsPaidForBill, markParticipantPaid } from "../services/participant.service";
import { sanitizeTransferDescription } from "../services/vietqr.service";

const router = Router();

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

function resolveAdminKey(input: { queryKey?: string; bodyKey?: string; headerKey?: string }): string | null {
  return input.queryKey ?? input.bodyKey ?? input.headerKey ?? null;
}

function requireAdminKey(candidate: string | null): void {
  if (!env.ADMIN_DASHBOARD_KEY) {
    throw new AppError("ADMIN_DASHBOARD_KEY is not configured", 503);
  }

  if (candidate !== env.ADMIN_DASHBOARD_KEY) {
    throw new AppError("Unauthorized", 401);
  }
}

router.get("/", async (req, res, next) => {
  try {
    const adminKey = resolveAdminKey({
      queryKey: typeof req.query.key === "string" ? req.query.key : undefined,
      headerKey: typeof req.headers["x-admin-key"] === "string" ? req.headers["x-admin-key"] : undefined,
    });
    requireAdminKey(adminKey);

    const bills = await prisma.bill.findMany({
      orderBy: { created_at: "desc" },
      take: 20,
      include: {
        participants: {
          orderBy: [{ status: "asc" }, { telegram_username: "asc" }],
        },
      },
    });

    const rows = bills
      .map((bill) => {
        const unpaidCount = bill.participants.filter((p) => p.status === "UNPAID").length;
        const participantsRows = bill.participants
          .map((participant) => {
            const username = escapeHtml(participant.telegram_username || "-");
            const transferDescription = sanitizeTransferDescription(
              bill.note?.trim() ? `${participant.telegram_username} ${bill.note.trim()}` : participant.telegram_username,
            );
            const paidAt = participant.paid_at ? new Date(participant.paid_at).toLocaleString("vi-VN") : "-";
            const action =
              participant.status === "PAID"
                ? "<span>Confirmed</span>"
                : `
                  <form method=\"post\" action=\"/admin/participants/${participant.id}/confirm\" style=\"margin:0\">
                    <input type=\"hidden\" name=\"key\" value=\"${escapeHtml(adminKey ?? "")}\" />
                    <button type=\"submit\">Confirm PAID</button>
                  </form>
                `;

            return `
              <tr>
                <td>${participant.telegram_id}</td>
                <td>${username}</td>
                <td>${participant.amount}</td>
                <td>${participant.status}</td>
                <td>${escapeHtml(paidAt)}</td>
                <td>${escapeHtml(transferDescription)}</td>
                <td>${action}</td>
              </tr>
            `;
          })
          .join("");

        return `
          <section style=\"margin-bottom:24px; border:1px solid #ddd; padding:12px; border-radius:8px;\">
            <h3 style=\"margin:0 0 8px 0\">Bill ${escapeHtml(bill.id)} (${bill.status})</h3>
            <div style=\"margin-bottom:8px\">Group: ${escapeHtml(bill.group_chat_id)} | Owner: ${escapeHtml(bill.owner_telegram_id)} | Per person: ${bill.per_person_amount}</div>
            <div style=\"margin-bottom:8px\">Transfer note template: ${escapeHtml(bill.note?.trim() || "(username only)")}</div>
            ${
              bill.status === "OPEN"
                ? `
                  <div style="display:flex;gap:8px;align-items:center;margin:0 0 10px 0">
                    <form method="post" action="/admin/bills/${bill.id}/confirm-all" style="margin:0">
                      <input type="hidden" name="key" value="${escapeHtml(adminKey ?? "")}" />
                      <button type="submit" style="background:#065f46;color:#fff;border:0;padding:8px 12px;border-radius:6px;cursor:pointer;">
                        Confirm All PAID (${unpaidCount})
                      </button>
                    </form>
                    <form method="post" action="/admin/bills/${bill.id}/cancel" style="margin:0">
                      <input type="hidden" name="key" value="${escapeHtml(adminKey ?? "")}" />
                      <button type="submit" style="background:#b91c1c;color:#fff;border:0;padding:8px 12px;border-radius:6px;cursor:pointer;">
                        Cancel Bill
                      </button>
                    </form>
                  </div>
                `
                : "<div style=\"margin:0 0 10px 0;color:#666;\">Bill is CLOSED.</div>"
            }
            <table border=\"1\" cellpadding=\"6\" cellspacing=\"0\" style=\"border-collapse:collapse; width:100%;\">
              <thead>
                <tr>
                  <th>Telegram ID</th>
                  <th>Username</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Paid At</th>
                  <th>Transfer Content</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${participantsRows || "<tr><td colspan=\"7\">No participants</td></tr>"}
              </tbody>
            </table>
          </section>
        `;
      })
      .join("");

    res.status(200).type("html").send(`
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>SplitBill Admin</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 1100px; margin: 24px auto; line-height: 1.4;">
          <h1>SplitBill Admin Dashboard</h1>
          <p>Recent 20 bills. Manual payment confirmation enabled.</p>
          ${rows || "<p>No bills found.</p>"}
        </body>
      </html>
    `);
  } catch (error) {
    next(error);
  }
});

router.post("/participants/:participantId/confirm", async (req, res, next) => {
  try {
    const adminKey = resolveAdminKey({
      bodyKey: typeof req.body?.key === "string" ? req.body.key : undefined,
      queryKey: typeof req.query.key === "string" ? req.query.key : undefined,
      headerKey: typeof req.headers["x-admin-key"] === "string" ? req.headers["x-admin-key"] : undefined,
    });
    requireAdminKey(adminKey);

    const participantId = req.params.participantId;
    const updated = await markParticipantPaid(participantId);

    logInfo("Participant marked as paid by admin", {
      participantId: updated.id,
      billId: updated.bill_id,
      billStatus: updated.bill.status,
    });

    res.redirect(303, `/admin?key=${encodeURIComponent(adminKey ?? "")}`);
  } catch (error) {
    logError("Admin confirm paid failed", error, {
      participantId: req.params.participantId,
    });
    next(error);
  }
});

router.post("/bills/:billId/cancel", async (req, res, next) => {
  try {
    const adminKey = resolveAdminKey({
      bodyKey: typeof req.body?.key === "string" ? req.body.key : undefined,
      queryKey: typeof req.query.key === "string" ? req.query.key : undefined,
      headerKey: typeof req.headers["x-admin-key"] === "string" ? req.headers["x-admin-key"] : undefined,
    });
    requireAdminKey(adminKey);

    const billId = req.params.billId;
    const bill = await cancelBillById(billId);

    logInfo("Bill cancelled by admin", {
      billId: bill.id,
      status: bill.status,
    });

    res.redirect(303, `/admin?key=${encodeURIComponent(adminKey ?? "")}`);
  } catch (error) {
    logError("Admin cancel bill failed", error, {
      billId: req.params.billId,
    });
    next(error);
  }
});

router.post("/bills/:billId/confirm-all", async (req, res, next) => {
  try {
    const adminKey = resolveAdminKey({
      bodyKey: typeof req.body?.key === "string" ? req.body.key : undefined,
      queryKey: typeof req.query.key === "string" ? req.query.key : undefined,
      headerKey: typeof req.headers["x-admin-key"] === "string" ? req.headers["x-admin-key"] : undefined,
    });
    requireAdminKey(adminKey);

    const billId = req.params.billId;
    const result = await confirmAllParticipantsPaidForBill(billId);

    logInfo("All participants confirmed paid by admin", {
      billId: result.billId,
      billStatus: result.billStatus,
      updatedCount: result.updatedCount,
    });

    res.redirect(303, `/admin?key=${encodeURIComponent(adminKey ?? "")}`);
  } catch (error) {
    logError("Admin confirm all paid failed", error, {
      billId: req.params.billId,
    });
    next(error);
  }
});

export default router;
