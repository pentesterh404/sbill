import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { AppError } from "../lib/errors";

const BANK_BIN_FILE_PATH = path.resolve(__dirname, "../../data/bank_bins.txt");
let bankBinMap: Map<string, string> | null = null;

function loadBankBinMap(): Map<string, string> {
  if (bankBinMap) return bankBinMap;

  if (!existsSync(BANK_BIN_FILE_PATH)) {
    throw new AppError(`Missing bank mapping file: ${BANK_BIN_FILE_PATH}`, 500);
  }

  const content = readFileSync(BANK_BIN_FILE_PATH, "utf8");
  const map = new Map<string, string>();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([a-z0-9_-]+)\s*(?:=|:|\s)\s*(\d{6})$/i);
    if (!match) continue;

    map.set(match[1].toLowerCase(), match[2]);
  }

  bankBinMap = map;
  return map;
}

export function resolveBankBin(bankAliasOrBin: string): string {
  const normalized = bankAliasOrBin.trim().toLowerCase();

  if (/^\d{6}$/.test(normalized)) {
    return normalized;
  }

  const map = loadBankBinMap();
  const bankBin = map.get(normalized);

  if (!bankBin) {
    throw new AppError(`Unsupported bank code: ${bankAliasOrBin}`, 400);
  }

  return bankBin;
}
