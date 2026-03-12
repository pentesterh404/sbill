import express, { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { AppError } from "./lib/errors";
import { logError, logInfo } from "./lib/logger";
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

  app.use(express.json({ limit: "1mb" }));
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
            <li><code>/s &lt;total_amount&gt; [&lt;num_people&gt;] [&lt;note&gt;]</code> - Create bill and send split QR immediately in group.</li>
            <li><code>/s &lt;bank_code&gt; &lt;account_number&gt; &lt;total_amount&gt; &lt;num_people&gt; [&lt;note&gt;]</code> - Create bill with dynamic bank/account from command.</li>
          </ul>
        </body>
      </html>
    `);
  });

  app.use("/telegram", telegramRateLimiter, telegramRouter);

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
