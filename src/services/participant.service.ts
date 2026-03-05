import crypto from "crypto";
import { Participant, ParticipantStatus } from "@prisma/client";
import { env } from "../config";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { getLatestOpenBill } from "./bill.service";

function tokenPayload(billId: string, telegramId: string): string {
  return `${billId}${telegramId}`;
}

export function generatePayToken(billId: string, telegramId: string): string {
  return crypto
    .createHmac("sha256", env.SERVER_SECRET)
    .update(tokenPayload(billId, telegramId))
    .digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "hex");
  const bBuf = Buffer.from(b, "hex");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export async function registerParticipant(input: {
  groupChatId: string;
  telegramId: string;
  username?: string;
  firstName: string;
}): Promise<{ participant: Participant; alreadyRegistered: boolean }> {
  const bill = await getLatestOpenBill(input.groupChatId);
  if (!bill) {
    throw new AppError("No OPEN bill found for this group", 404);
  }

  const existing = await prisma.participant.findUnique({
    where: {
      bill_id_telegram_id: {
        bill_id: bill.id,
        telegram_id: input.telegramId,
      },
    },
  });

  if (existing) {
    return { participant: existing, alreadyRegistered: true };
  }

  const payToken = generatePayToken(bill.id, input.telegramId);
  const tokenExpiresAt = new Date(Date.now() + env.PAY_TOKEN_TTL_SECONDS * 1000);

  const participant = await prisma.participant.create({
    data: {
      bill_id: bill.id,
      telegram_id: input.telegramId,
      telegram_username: input.username ?? input.firstName,
      amount: bill.per_person_amount,
      status: ParticipantStatus.UNPAID,
      pay_token: payToken,
      pay_token_expires_at: tokenExpiresAt,
    },
  });

  return { participant, alreadyRegistered: false };
}

export async function getParticipantByValidToken(token: string): Promise<Participant & { bill: { id: string; note: string | null } }> {
  const participant = await prisma.participant.findUnique({
    where: { pay_token: token },
    include: {
      bill: {
        select: {
          id: true,
          note: true,
        },
      },
    },
  });

  if (!participant) {
    throw new AppError("Invalid payment link", 404);
  }

  if (participant.pay_token_expires_at.getTime() < Date.now()) {
    throw new AppError("Payment link expired", 410);
  }

  const expected = generatePayToken(participant.bill_id, participant.telegram_id);
  if (!safeEqualHex(expected, token)) {
    throw new AppError("Invalid payment link", 401);
  }

  return participant;
}

export async function markParticipantPaid(participantId: string): Promise<Participant & { bill: { id: string; status: "OPEN" | "CLOSED" } }> {
  const current = await prisma.participant.findUnique({
    where: { id: participantId },
    include: {
      bill: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!current) {
    throw new AppError("Participant not found", 404);
  }

  if (current.status === ParticipantStatus.PAID) {
    return current;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const paidParticipant = await tx.participant.update({
      where: { id: participantId },
      data: {
        status: ParticipantStatus.PAID,
        paid_at: new Date(),
      },
      include: {
        bill: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    const unpaidCount = await tx.participant.count({
      where: {
        bill_id: paidParticipant.bill_id,
        status: ParticipantStatus.UNPAID,
      },
    });

    if (unpaidCount === 0) {
      await tx.bill.update({
        where: { id: paidParticipant.bill_id },
        data: { status: "CLOSED" },
      });
      paidParticipant.bill.status = "CLOSED";
    }

    return paidParticipant;
  });

  return updated;
}
