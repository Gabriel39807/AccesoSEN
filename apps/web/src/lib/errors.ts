export function toErrorMessage(input: any, fallback = "Ocurrio un error."): string {
  const data = input?.response?.data;

  if (typeof data?.message === "string" && data.message.trim()) return data.message;
  if (typeof data?.motivo === "string" && data.motivo.trim()) return data.motivo;
  if (typeof data?.detail === "string" && data.detail.trim()) return data.detail;

  if (typeof data === "string" && data.trim()) return data;
  if (typeof input?.message === "string" && input.message.trim()) return input.message;

  if (data && typeof data === "object") {
    try {
      return JSON.stringify(data);
    } catch {
      return fallback;
    }
  }
  return fallback;
}
