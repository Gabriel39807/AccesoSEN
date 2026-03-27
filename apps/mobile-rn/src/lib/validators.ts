export function sanitizeDigits(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

export function isSignedScanToken(value: string): boolean {
  const clean = String(value || "").trim().toUpperCase();
  return clean.startsWith("SADI1:") || clean.startsWith("SADI1B64:");
}

export function normalizeScanValue(value: string): string {
  const clean = String(value || "").trim();
  return isSignedScanToken(clean) ? clean : sanitizeDigits(clean).slice(0, 10);
}

export function validatePhone10(value: string): string | null {
  const clean = String(value || "").trim();
  if (!/^\d{10}$/.test(clean)) {
    return "El teléfono debe tener exactamente 10 dígitos.";
  }
  return null;
}

export function validateDocument6to10(value: string): string | null {
  const clean = String(value || "").trim();
  if (!/^\d{6,10}$/.test(clean)) {
    return "El documento debe tener entre 6 y 10 dígitos.";
  }
  return null;
}

export function validateScanValue(value: string): string | null {
  const clean = String(value || "").trim();
  if (!clean) {
    return "Ingresa o escanea un documento.";
  }
  if (isSignedScanToken(clean)) {
    return null;
  }
  return validateDocument6to10(clean);
}
