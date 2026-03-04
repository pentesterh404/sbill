import { Router } from "express";
import { env } from "../config";
import { AppError } from "../lib/errors";
import { createBill, parseSplitCommand } from "../services/bill.service";
import { registerParticipant } from "../services/participant.service";
import { sendMessage } from "../services/telegram.service";
import { TelegramUpdate } from "../types/telegram";

const router = Router();

function parseLinkCommand(text: string): boolean {
  return /^\/link(?:@\w+)?$/i.test(text.trim());
}

router.post("/webhook", async (req, res) => {
  const update = req.body as TelegramUpdate;
  const message = update.message ?? update.callback_query?.message;
  const actor = update.message?.from ?? update.callback_query?.from;
  const chatId = message ? String(message.chat.id) : null;

  try {
    if (!message || !actor || !message.text) {
      res.status(200).json({ ok: true });
      return;
    }

    const text = message.text.trim();
    const chatType = message.chat.type;
    const chatId = String(message.chat.id);
    const actorId = String(actor.id);

    if (/^\/s(?:@\w+)?(?:\s|$)/i.test(text)) {
      if (chatType !== "group" && chatType !== "supergroup") {
        throw new AppError("/s is only allowed in group chats", 400);
      }

      const parsed = parseSplitCommand(text);
      const bill = await createBill({
        groupChatId: chatId,
        ownerTelegramId: actorId,
        totalAmount: parsed.totalAmount,
        numPeople: parsed.numPeople,
        note: parsed.note,
      });

      await sendMessage(
        chatId,
        `Bill created. ID: ${bill.id}\nPer person: ${bill.per_person_amount}\nEveryone run /link in this group to receive a private payment link.`,
      );

      res.status(200).json({ ok: true });
      return;
    }

    if (parseLinkCommand(text)) {
      if (chatType !== "group" && chatType !== "supergroup") {
        throw new AppError("/link is only allowed in group chats", 400);
      }

      const { participant, alreadyRegistered } = await registerParticipant({
        groupChatId: chatId,
        telegramId: actorId,
        username: actor.username,
        firstName: actor.first_name,
      });

      const payUrl = `${env.APP_BASE_URL}/pay/${participant.pay_token}`;
      const displayName = actor.username ? `@${actor.username}` : actor.first_name;

      await sendMessage(
        chatId,
        alreadyRegistered
          ? `${displayName} you already joined this bill.\nBill: ${participant.bill_id}\nAmount: ${participant.amount}\nPay link: ${payUrl}`
          : `${displayName} registered successfully.\nBill: ${participant.bill_id}\nAmount: ${participant.amount}\nPay link: ${payUrl}`,
        { replyToMessageId: message.message_id },
      );

      res.status(200).json({ ok: true });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    if (chatId) {
      const messageText = error instanceof AppError ? error.message : "Unable to process command";
      try {
        await sendMessage(chatId, messageText);
      } catch {
        // Best effort only.
      }
    }

    if (!(error instanceof AppError)) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
    res.status(200).json({ ok: true });
  }
});

export default router;
