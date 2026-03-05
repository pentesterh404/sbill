import { env } from "../config";
import { logError } from "../lib/logger";

const apiBase = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;

async function telegramRequest(method: string, payload: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${apiBase}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    logError("Telegram API request failed", undefined, {
      method,
      status: response.status,
      body,
    });
    throw new Error(`Telegram API ${method} failed: ${response.status} ${body}`);
  }
}

export async function sendMessage(
  chatId: string,
  text: string,
  options?: { replyToMessageId?: number },
): Promise<void> {
  await telegramRequest("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    reply_to_message_id: options?.replyToMessageId,
  });
}
