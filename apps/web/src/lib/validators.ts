export function sanitizeDigits(value: string): string {
  return String(value || "").replace(/\D/g, "");
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
