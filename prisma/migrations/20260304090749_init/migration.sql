-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('UNPAID', 'PAID');

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "group_chat_id" TEXT NOT NULL,
    "owner_telegram_id" TEXT NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "per_person_amount" INTEGER NOT NULL,
    "note" TEXT,
    "status" "BillStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "telegram_id" TEXT NOT NULL,
    "telegram_username" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'UNPAID',
    "pay_token" TEXT NOT NULL,
    "pay_token_expires_at" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bill_group_chat_id_status_created_at_idx" ON "Bill"("group_chat_id", "status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Participant_pay_token_key" ON "Participant"("pay_token");

-- CreateIndex
CREATE INDEX "Participant_pay_token_expires_at_idx" ON "Participant"("pay_token_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_bill_id_telegram_id_key" ON "Participant"("bill_id", "telegram_id");

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
