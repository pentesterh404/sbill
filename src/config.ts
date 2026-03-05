import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(8).optional(),
  VIETQR_BANK_CODE: z.string().min(3),
  VIETQR_BANK_NAME: z.string().min(2).optional(),
  VIETQR_ACCOUNT_NUMBER: z.string().min(4),
  VIETQR_ACCOUNT_NAME: z.string().min(2),
});

export const env = envSchema.parse(process.env);
