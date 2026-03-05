export function logInfo(message: string, meta?: Record<string, unknown>): void {
  if (meta) {
    // eslint-disable-next-line no-console
    console.log(`[INFO] ${new Date().toISOString()} ${message}`, meta);
    return;
  }
  // eslint-disable-next-line no-console
  console.log(`[INFO] ${new Date().toISOString()} ${message}`);
}

export function logError(message: string, error?: unknown, meta?: Record<string, unknown>): void {
  if (meta) {
    // eslint-disable-next-line no-console
    console.error(`[ERROR] ${new Date().toISOString()} ${message}`, meta);
  } else {
    // eslint-disable-next-line no-console
    console.error(`[ERROR] ${new Date().toISOString()} ${message}`);
  }

  if (error) {
    // eslint-disable-next-line no-console
    console.error(error);
  }
}