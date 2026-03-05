import "dotenv/config";
import type { Server } from "node:http";
import { env } from "./config";
import { app } from "./app";

const MAX_PORT_ATTEMPTS = 20;
let server: Server;

async function listenOnPort(port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const nextServer = app.listen(port);

    nextServer.once("listening", () => resolve(nextServer));
    nextServer.once("error", (error: NodeJS.ErrnoException) => {
      nextServer.close();
      reject(error);
    });
  });
}

async function startServer(): Promise<void> {
  let port = env.PORT;

  for (let attempt = 0; attempt < MAX_PORT_ATTEMPTS; attempt += 1) {
    try {
      server = await listenOnPort(port);
      // eslint-disable-next-line no-console
      console.log(`Server listening on port ${port}`);

      if (port !== env.PORT) {
        // eslint-disable-next-line no-console
        console.log(`Configured PORT ${env.PORT} was busy, fallback port ${port} is used.`);
      }
      return;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== "EADDRINUSE") {
        throw err;
      }
      port += 1;
    }
  }

  throw new Error(`Unable to find available port after ${MAX_PORT_ATTEMPTS} attempts from ${env.PORT}`);
}

async function shutdown(signal: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`Received ${signal}. Graceful shutdown...`);
  if (!server) {
    process.exit(0);
  }

  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

void startServer().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", error);
  process.exit(1);
});
