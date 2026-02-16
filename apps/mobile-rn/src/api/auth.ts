import { api } from "./client";
import { saveTokens } from "../storage/tokens";

export type Rol = "admin" | "aprendiz" | "guarda";

export type Usuario = {
  id: number;
  username: string;
  rol: Rol;
  must_change_password?: boolean;
  first_name?: string;
  last_name?: string;
  documento?: string | null;
  sede_principal?: string | null;
  programa_formacion?: string | null;
};

export async function login(username: string, password: string) {
  const r = await api.post("/api/token/", { username, password });
  await saveTokens(r.data.access, r.data.refresh);
  return r.data as { access: string; refresh: string };
}

export async function me() {
  const r = await api.get("/api/me/");
  // r.data = { permitido, motivo, usuario }
  return r.data as { permitido: boolean; motivo: string | null; usuario: Usuario };
}

export async function passwordResetRequest(params: {
  channel?: "email" | "whatsapp";
  email?: string;
  telefono?: string;
}) {
  const channel = params.channel || "email";
  const payload: any = { channel };
  if (params.email) payload.email = params.email;
  if (params.telefono) payload.telefono = params.telefono;
  const r = await api.post("/api/auth/password-reset/request/", payload);
  return r.data as { permitido: boolean; motivo: string | null; mensaje?: string };
}

export async function changeInitialPassword(current_password: string, new_password: string) {
  const r = await api.post("/api/auth/change-initial-password/", { current_password, new_password });
  return r.data as { permitido: boolean; motivo: string | null; mensaje?: string };
}

export async function passwordResetVerify(email: string, otp: string) {
  const r = await api.post("/api/auth/password-reset/verify/", { email, otp, channel: "email" });
  return r.data as { permitido: boolean; motivo: string | null };
}

export async function passwordResetVerifyWithChannel(
  identifier: { email?: string; telefono?: string },
  otp: string,
  channel: "email" | "whatsapp" = "email"
) {
  const payload: any = { otp, channel };
  if (identifier.email) payload.email = identifier.email;
  if (identifier.telefono) payload.telefono = identifier.telefono;
  const r = await api.post("/api/auth/password-reset/verify/", payload);
  return r.data as { permitido: boolean; motivo: string | null };
}

export async function passwordResetConfirm(email: string, otp: string, new_password: string) {
  const r = await api.post("/api/auth/password-reset/confirm/", { email, otp, new_password, channel: "email" });
  return r.data as { permitido: boolean; motivo: string | null };
}

export async function passwordResetConfirmWithChannel(
  identifier: { email?: string; telefono?: string },
  otp: string,
  new_password: string,
  channel: "email" | "whatsapp" = "email"
) {
  const payload: any = { otp, new_password, channel };
  if (identifier.email) payload.email = identifier.email;
  if (identifier.telefono) payload.telefono = identifier.telefono;
  const r = await api.post("/api/auth/password-reset/confirm/", payload);
  return r.data as { permitido: boolean; motivo: string | null };
}
