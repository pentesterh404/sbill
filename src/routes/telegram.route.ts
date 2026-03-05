import { Router } from "express";
import crypto from "crypto";
import { env } from "../config";
import { AppError } from "../lib/errors";
import { logError, logInfo } from "../lib/logger";
import { createBill, parseSplitCommand } from "../services/bill.service";
import { registerParticipant } from "../services/participant.service";
import { sendMessage } from "../services/telegram.service";
import { TelegramUpdate } from "../types/telegram";

const router = Router();

function parseLinkCommand(text: string): boolean {
  return /^\/link(?:@\w+)?$/i.test(text.trim());
}

function safeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function extractCommand(text?: string): string | null {
  if (!text) return null;
  const command = text.trim().split(/\s+/)[0];
  return command || null;
}

router.post("/webhook", async (req, res) => {
  const update = req.body as TelegramUpdate;
  const message = update.message ?? update.callback_query?.message;
  const actor = update.message?.from ?? update.callback_query?.from;
  const chatId = message ? String(message.chat.id) : null;
  const command = extractCommand(message?.text);
  const secretHeader = req.headers["x-telegram-bot-api-secret-token"];
  const webhookSecret = typeof secretHeader === "string" ? secretHeader : null;

  logInfo("Telegram webhook received", {
    updateId: update.update_id,
    hasMessage: Boolean(update.message),
    hasCallbackQuery: Boolean(update.callback_query),
    chatId,
    actorId: actor ? String(actor.id) : null,
    command,
  });

  try {
    if (env.TELEGRAM_WEBHOOK_SECRET) {
      if (!webhookSecret || !safeEqualString(webhookSecret, env.TELEGRAM_WEBHOOK_SECRET)) {
        logError("Telegram webhook rejected: invalid secret token", undefined, {
          updateId: update.update_id,
          chatId,
        });
        res.status(401).json({ error: "Unauthorized webhook" });
        return;
      }
    }

    if (!message || !actor || !message.text) {
      logInfo("Telegram update ignored: missing message/actor/text", { updateId: update.update_id });
      res.status(200).json({ ok: true });
      return;
    }

    const text = message.text.trim();
    const chatType = message.chat.type;
    const messageChatId = String(message.chat.id);
    const actorId = String(actor.id);

    if (/^\/s(?:@\w+)?(?:\s|$)/i.test(text)) {
      logInfo("Handling /s command", {
        updateId: update.update_id,
        chatId: messageChatId,
        actorId,
        command,
      });
      if (chatType !== "group" && chatType !== "supergroup") {
        throw new AppError("/s is only allowed in group chats", 400);
      }

      const parsed = parseSplitCommand(text);
      const bill = await createBill({
        groupChatId: messageChatId,
        ownerTelegramId: actorId,
        totalAmount: parsed.totalAmount,
        numPeople: parsed.numPeople,
        note: parsed.note,
      });

      logInfo("Bill created", {
        billId: bill.id,
        groupChatId: messageChatId,
        ownerTelegramId: actorId,
        perPersonAmount: bill.per_person_amount,
      });

      await sendMessage(
        messageChatId,
        `Bill created. ID: ${bill.id}\nPer person: ${bill.per_person_amount}\nEveryone run /link in this group to receive a private payment link.`,
      );

      res.status(200).json({ ok: true });
      return;
    }

    if (parseLinkCommand(text)) {
      logInfo("Handling /link command", {
        updateId: update.update_id,
        chatId: messageChatId,
        actorId,
      });
      if (chatType !== "group" && chatType !== "supergroup") {
        throw new AppError("/link is only allowed in group chats", 400);
      }

      const { participant, alreadyRegistered } = await registerParticipant({
        groupChatId: messageChatId,
        telegramId: actorId,
        username: actor.username,
        firstName: actor.first_name,
      });

      const payUrl = `${env.APP_BASE_URL}/pay/${participant.pay_token}`;
      const displayName = actor.username ? `@${actor.username}` : actor.first_name;

      logInfo("Participant link generated", {
        participantId: participant.id,
        billId: participant.bill_id,
        telegramId: participant.telegram_id,
        alreadyRegistered,
      });

      await sendMessage(
        messageChatId,
        alreadyRegistered
          ? `${displayName} you already joined this bill.\nBill: ${participant.bill_id}\nAmount: ${participant.amount}\nPay link: ${payUrl}`
          : `${displayName} registered successfully.\nBill: ${participant.bill_id}\nAmount: ${participant.amount}\nPay link: ${payUrl}`,
        { replyToMessageId: message.message_id },
      );

      res.status(200).json({ ok: true });
      return;
    }

    logInfo("Telegram command ignored: unsupported text", {
      updateId: update.update_id,
      command,
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    logError("Telegram webhook processing failed", error, {
      updateId: update.update_id,
      chatId,
      command,
    });

    if (chatId) {
      const messageText = error instanceof AppError ? error.message : "Unable to process command";
      try {
        await sendMessage(chatId, messageText);
      } catch {
        logError("Failed to send Telegram fallback message", undefined, {
          chatId,
          updateId: update.update_id,
        });
      }
    }

    res.status(200).json({ ok: true });
  }
});

export default router;
