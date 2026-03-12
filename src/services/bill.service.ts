import { randomUUID } from "node:crypto";
import { AppError } from "../lib/errors";

function parseTotalAmount(raw: string): number {
  const match = raw.trim().match(/^(\d+)(k)?$/i);
  if (!match) {
    throw new AppError("total_amount must be a positive integer or end with k (example: 10k)", 400);
  }

  const base = Number(match[1]);
  const hasK = Boolean(match[2]);
  const parsed = hasK ? base * 1000 : base;

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError("total_amount must be a positive integer", 400);
  }

  return parsed;
}

function parseNumPeople(raw?: string): number {
  const numPeople = raw ? Number(raw) : 1;

  if (!Number.isInteger(numPeople) || numPeople <= 0 || numPeople > 1000) {
    throw new AppError("num_people must be a positive integer <= 1000", 400);
  }

  return numPeople;
}

export type ParsedSplitCommand = {
  totalAmount: number;
  numPeople: number;
  note?: string;
  bankAlias?: string;
  accountNumber?: string;
};

export function parseSplitCommand(text: string): ParsedSplitCommand {
  const trimmed = text.trim();
  const body = trimmed.replace(/^\/s(?:@\w+)?\s*/i, "").trim();

  if (!body) {
    throw new AppError(
      "Invalid /s command format. Use: /s <total_amount> [num_people] [note] OR /s <bank_code> <account_number> <total_amount> <num_people> [note]",
      400,
    );
  }

  const parts = body.split(/\s+/);

  // New format: /s <bank_code> <account_number> <total_amount> <num_people> [note]
  if (parts.length >= 4 && /^(\d+)(k)?$/i.test(parts[2]) && /^\d+$/.test(parts[3])) {
    const bankAlias = parts[0].toLowerCase();
    const accountNumber = parts[1];
    const totalAmount = parseTotalAmount(parts[2]);
    const numPeople = parseNumPeople(parts[3]);
    const note = parts.slice(4).join(" ").trim() || undefined;

    if (!/^\d{6,30}$/.test(accountNumber)) {
      throw new AppError("account_number must contain 6-30 digits", 400);
    }

    return { bankAlias, accountNumber, totalAmount, numPeople, note };
  }

  // Legacy format: /s <total_amount> [num_people] [note]
  if (!/^(\d+)(k)?$/i.test(parts[0])) {
    throw new AppError(
      "Invalid /s command format. Use: /s <total_amount> [num_people] [note] OR /s <bank_code> <account_number> <total_amount> <num_people> [note]",
      400,
    );
  }

  const totalAmount = parseTotalAmount(parts[0]);
  const hasNumPeople = parts[1] ? /^\d+$/.test(parts[1]) : false;
  const numPeople = parseNumPeople(hasNumPeople ? parts[1] : undefined);
  const note = (hasNumPeople ? parts.slice(2) : parts.slice(1)).join(" ").trim() || undefined;

  return { totalAmount, numPeople, note };
}

export async function createBill(params: {
  groupChatId: string;
  ownerTelegramId: string;
  totalAmount: number;
  numPeople: number;
  note?: string;
}): Promise<{
  id: string;
  group_chat_id: string;
  owner_telegram_id: string;
  total_amount: number;
  per_person_amount: number;
  note?: string;
  status: "OPEN";
}> {
  const perPersonAmount = Math.ceil(params.totalAmount / params.numPeople);

  return {
    id: randomUUID(),
    group_chat_id: params.groupChatId,
    owner_telegram_id: params.ownerTelegramId,
    total_amount: params.totalAmount,
    per_person_amount: perPersonAmount,
    note: params.note,
    status: "OPEN",
  };
}
