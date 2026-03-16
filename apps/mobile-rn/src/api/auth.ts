import { isBiometricAvailable } from "../auth/biometric";
import { getOrCreateDeviceId, saveTokens, setBiometricEnabled } from "../storage/tokens";
import { api, refreshAccessToken } from "./client";

export type Rol = "superadmin" | "admin_sede" | "aprendiz" | "guarda";

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
  telefono?: string | null;
  email?: string | null;
  force_password_reset?: boolean;
};

async function loginRequest(payload: Record<string, unknown>) {
  try {
    return await api.post("/api/auth/login/", payload);
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return api.post("/api/token/", payload);
    }
    throw error;
  }
}

export async function login(username: string, password: string, expected_role?: "admin" | "guarda" | "aprendiz") {
  const deviceId = await getOrCreateDeviceId();
  const payload: any = { username, password, device_id: deviceId };
  if (expected_role) payload.expected_role = expected_role;

  const r = await loginRequest(payload);
  await saveTokens(r.data.access, r.data.refresh);

  // Primer login exitoso: deja habilitado el flujo biométrico si existe hardware.
  if (await isBiometricAvailable()) {
    await setBiometricEnabled(true);
  }

  return r.data as { access: string; refresh: string };
}

export async function loginWithBiometric() {
  const access = await refreshAccessToken({ requireBiometric: true });
  if (!access) {
    throw new Error("No hay una sesión guardada para este dispositivo.");
  }
  return { access };
}

export async function logout(device_id?: string) {
  const deviceId = device_id || (await getOrCreateDeviceId());
  try {
    await api.post("/api/auth/logout/", { device_id: deviceId });
  } catch {
    // El cierre local se hace igual, incluso si el servidor no responde.
  }
}

export async function logoutAll() {
  try {
    await api.post("/api/auth/logout-all/");
  } catch {
    // noop
  }
}

export async function me() {
  const r = await api.get("/api/me/");
  return r.data as { permitido: boolean; motivo: string | null; usuario: Usuario };
}

export async function passwordResetRequest(email: string) {
  const r = await api.post("/api/auth/password-reset/request/", { email: email.trim().toLowerCase() });
  return r.data as { permitido: boolean; motivo: string | null; mensaje?: string };
}

export async function changeInitialPassword(current_password: string, new_password: string) {
  const r = await api.post("/api/auth/change-initial-password/", { current_password, new_password });
  return r.data as { permitido: boolean; motivo: string | null; mensaje?: string };
}

export async function passwordResetVerify(email: string, otp: string) {
  const r = await api.post("/api/auth/password-reset/verify/", { email: email.trim().toLowerCase(), otp });
  return r.data as { permitido: boolean; motivo: string | null };
}

export async function passwordResetConfirm(email: string, otp: string, new_password: string) {
  const r = await api.post("/api/auth/password-reset/confirm/", {
    email: email.trim().toLowerCase(),
    otp,
    new_password,
  });
  return r.data as { permitido: boolean; motivo: string | null };
}

export type AprendizPerfil = {
  id: number;
  username: string;
  email: string | null;
  first_name: string;
  last_name: string;
  documento: string | null;
  rol: Rol;
  estado: string;
  sede_principal: string | null;
  jornada: string | null;
  programa_formacion: string | null;
  telefono: string | null;
  must_change_password: boolean;
  force_password_reset: boolean;
  pending_email_change?: string | null;
};

export async function getAprendizPerfil() {
  const r = await api.get("/api/aprendiz/perfil/");
  return r.data as { permitido: boolean; motivo: string | null; perfil: AprendizPerfil };
}

export async function updateAprendizPerfil(input: { telefono: string }) {
  const r = await api.patch("/api/aprendiz/perfil/", { telefono: input.telefono });
  return r.data as { permitido: boolean; motivo: string | null; perfil: AprendizPerfil; mensaje?: string };
}

export async function requestAprendizEmailChange(new_email: string) {
  const r = await api.post("/api/aprendiz/perfil/email-change/request/", { new_email: new_email.trim().toLowerCase() });
  return r.data as { permitido: boolean; motivo: string | null; mensaje?: string };
}

export async function confirmAprendizEmailChange(new_email: string, otp: string) {
  const r = await api.post("/api/aprendiz/perfil/email-change/confirm/", {
    new_email: new_email.trim().toLowerCase(),
    otp,
  });
  return r.data as { permitido: boolean; motivo: string | null; perfil: AprendizPerfil; mensaje?: string };
}
