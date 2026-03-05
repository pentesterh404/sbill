import { env } from "../config";
import { logError } from "../lib/logger";

const apiBase = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;

async function ensureTelegramResponse(method: string, response: Response): Promise<void> {
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

async function telegramRequest(method: string, payload: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${apiBase}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  await ensureTelegramResponse(method, response);
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

export async function sendPhotoBuffer(
  chatId: string,
  photoBuffer: Buffer,
  caption: string,
  options?: { replyToMessageId?: number; parseMode?: "Markdown" | "MarkdownV2" | "HTML"; filename?: string },
): Promise<void> {
  const formData = new FormData();
  const filename = options?.filename ?? "qr.png";

  formData.append("chat_id", chatId);
  formData.append("caption", caption);
  if (options?.replyToMessageId) {
    formData.append("reply_to_message_id", String(options.replyToMessageId));
  }
  if (options?.parseMode) {
    formData.append("parse_mode", options.parseMode);
  }
  const safeBytes = Uint8Array.from(photoBuffer.values());
  formData.append("photo", new Blob([safeBytes], { type: "image/png" }), filename);

  const response = await fetch(`${apiBase}/sendPhoto`, {
    method: "POST",
    body: formData,
  });

  await ensureTelegramResponse("sendPhoto", response);
}
