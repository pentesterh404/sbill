import express, { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { AppError } from "./lib/errors";
import { logError, logInfo } from "./lib/logger";
import adminRouter from "./routes/admin.route";
import payRouter from "./routes/pay.route";
import telegramRouter from "./routes/telegram.route";

export function createApp() {
  const app = express();
  const telegramRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many webhook requests" },
  });
  const payRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many pay requests" },
  });
  const adminRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many admin requests" },
  });

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));
  app.use((req, res, next) => {
    const start = Date.now();
    logInfo("HTTP request start", {
      method: req.method,
      path: req.path,
    });

    res.on("finish", () => {
      logInfo("HTTP request done", {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
      });
    });

    next();
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.get("/", (_req, res) => {
    res.status(200).type("html").send(`
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>SplitBill Dashboard</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 760px; margin: 40px auto; line-height: 1.5;">
          <h1>SplitBill Dashboard</h1>
          <p>Backend is running.</p>

          <h2>Telegram Commands</h2>
          <ul>
            <li><code>/s &lt;total_amount&gt; &lt;num_people&gt; &lt;note?&gt;</code> - Create a new OPEN bill in group chat.</li>
            <li><code>/p</code> - Register yourself to latest OPEN bill and receive payment link reply in group.</li>
          </ul>
        </body>
      </html>
    `);
  });

  app.use("/telegram", telegramRateLimiter, telegramRouter);
  app.use("/pay", payRateLimiter, payRouter);
  app.use("/admin", adminRateLimiter, adminRouter);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const statusCode = err instanceof AppError ? err.statusCode : 500;
    const message = err instanceof AppError ? err.message : "Internal server error";

    if (statusCode >= 500) {
      logError("Unhandled application error", err, { statusCode });
    }

    res.status(statusCode).json({ error: message });
  });

  return app;
}

export const app = createApp();
