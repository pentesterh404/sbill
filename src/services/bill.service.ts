import { Bill } from "@prisma/client";
import { prisma } from "../lib/prisma";
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

export function parseSplitCommand(text: string): { totalAmount: number; numPeople: number; note?: string } {
  const trimmed = text.trim();
  const match = trimmed.match(/^\/s(?:@\w+)?\s+(\d+k?)\s+(\d+)(?:\s+([\s\S]+))?$/i);

  if (!match) {
    throw new AppError("Invalid /s command format. Use: /s <total_amount> <num_people> <note?>", 400);
  }

  const totalAmount = parseTotalAmount(match[1]);
  const numPeople = Number(match[2]);
  const note = match[3]?.trim();

  if (!Number.isInteger(numPeople) || numPeople <= 0 || numPeople > 1000) {
    throw new AppError("num_people must be a positive integer <= 1000", 400);
  }

  return { totalAmount, numPeople, note };
}

export async function createBill(params: {
  groupChatId: string;
  ownerTelegramId: string;
  totalAmount: number;
  numPeople: number;
  note?: string;
}): Promise<Bill> {
  const perPersonAmount = Math.ceil(params.totalAmount / params.numPeople);

  return prisma.bill.create({
    data: {
      group_chat_id: params.groupChatId,
      owner_telegram_id: params.ownerTelegramId,
      total_amount: params.totalAmount,
      per_person_amount: perPersonAmount,
      note: params.note,
      status: "OPEN",
    },
  });
}

export async function getLatestOpenBill(groupChatId: string): Promise<Bill | null> {
  return prisma.bill.findFirst({
    where: {
      group_chat_id: groupChatId,
      status: "OPEN",
    },
    orderBy: { created_at: "desc" },
  });
}

export async function cancelBillById(billId: string): Promise<Bill> {
  const existing = await prisma.bill.findUnique({
    where: { id: billId },
  });

  if (!existing) {
    throw new AppError("Bill not found", 404);
  }

  if (existing.status === "CLOSED") {
    return existing;
  }

  return prisma.bill.update({
    where: { id: billId },
    data: { status: "CLOSED" },
  });
}
