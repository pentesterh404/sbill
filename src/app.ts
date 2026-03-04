import express, { NextFunction, Request, Response } from "express";
import { AppError } from "./lib/errors";
import payRouter from "./routes/pay.route";
import telegramRouter from "./routes/telegram.route";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "1mb" }));

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
            <li><code>/link</code> - Register yourself to latest OPEN bill and receive private payment link.</li>
          </ul>

          <h2>HTTP Endpoints</h2>
          <ul>
            <li><code>POST /telegram/webhook</code></li>
            <li><code>GET /pay/:token</code></li>
            <li><code>GET /health</code></li>
          </ul>

          <h2>Quick Checks</h2>
          <ul>
            <li><a href="/health">Health Check</a></li>
          </ul>
        </body>
      </html>
    `);
  });

  app.use("/telegram", telegramRouter);
  app.use("/pay", payRouter);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const statusCode = err instanceof AppError ? err.statusCode : 500;
    const message = err instanceof AppError ? err.message : "Internal server error";

    if (statusCode >= 500) {
      // eslint-disable-next-line no-console
      console.error(err);
    }

    res.status(statusCode).json({ error: message });
  });

  return app;
}

export const app = createApp();
