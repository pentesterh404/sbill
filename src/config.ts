import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  APP_BASE_URL: z.string().url(),
  SERVER_SECRET: z.string().min(32),
  PAY_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
  VIETQR_BANK_CODE: z.string().min(3),
  VIETQR_ACCOUNT_NUMBER: z.string().min(4),
  VIETQR_ACCOUNT_NAME: z.string().min(2),
});

export const env = envSchema.parse(process.env);