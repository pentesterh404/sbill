import QRCode from "qrcode";

function tlv(id: string, value: string): string {
  const length = value.length.toString().padStart(2, "0");
  return `${id}${length}${value}`;
}

function crc16Ccitt(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function sanitizeTransferDescription(raw: string): string {
  const noPipes = raw.replace(/\|/g, "-");
  const safeCharsOnly = noPipes.replace(/[^\p{L}\p{N} ._\-/]/gu, "");
  const compact = safeCharsOnly.replace(/\s+/g, " ").trim();
  const shortened = compact.slice(0, 50);
  return shortened.length > 0 ? shortened : "khong co";
}

export function buildVietQrPayload(input: {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  description?: string;
}): string {
  const beneficiary = tlv("00", input.bankCode) + tlv("01", input.accountNumber);
  const vietQrService = tlv("01", beneficiary) + tlv("02", "QRIBFTTA");
  const merchantAccount = tlv(
    "38",
    tlv("00", "A000000727") + vietQrService,
  );

  const description = input.description?.trim() ?? "";
  const additionalData = description ? tlv("62", tlv("08", description)) : "";

  const payloadWithoutCrc =
    tlv("00", "01") +
    tlv("01", "12") +
    merchantAccount +
    tlv("53", "704") +
    tlv("54", String(input.amount)) +
    tlv("58", "VN") +
    tlv("59", input.accountName) +
    tlv("60", "HCM") +
    additionalData +
    "6304";

  return payloadWithoutCrc + crc16Ccitt(payloadWithoutCrc);
}

export async function generateVietQrSvg(input: {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  description?: string;
}): Promise<string> {
  const payload = buildVietQrPayload(input);
  return QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
  });
}

export async function generateVietQrPng(input: {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  description?: string;
}): Promise<Buffer> {
  const payload = buildVietQrPayload(input);
  return QRCode.toBuffer(payload, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 640,
  });
}
