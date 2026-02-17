"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearTokens, saveTokens } from "@/lib/auth";
import { toErrorMessage } from "@/lib/errors";
import { AuthButton, AuthCard, AuthInput, AuthLayout, RoleSwitch, type AuthRole } from "@/components/auth";
import styles from "@/components/auth/auth.module.css";

type MeResponse = {
  permitido: boolean;
  motivo: string | null;
  usuario: {
    id: number;
    username: string;
    rol: "admin" | "superadmin" | "admin_sede" | "aprendiz" | "guarda";
    must_change_password?: boolean;
    force_password_reset?: boolean;
  };
};

type PasskeyAuthOptionsResponse = {
  permitido: boolean;
  request_id: string;
  challenge: string;
  rp_id: string;
  timeout: number;
  allow_credentials: Array<{ credential_id: string; transports?: string[] }>;
  mock?: boolean;
};

function stringToBytes(value: string) {
  return new TextEncoder().encode(value);
}

function toBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginFailTick, setLoginFailTick] = useState(0);
  const [role, setRole] = useState<AuthRole>("admin");
  const [showPassword, setShowPassword] = useState(false);
  const [lockRemainingSec, setLockRemainingSec] = useState(0);

  const passkeySupported = typeof window !== "undefined" && "PublicKeyCredential" in window && !!navigator.credentials;
  const bloqueado = lockRemainingSec > 0;

  useEffect(() => {
    if (lockRemainingSec <= 0) return;
    const t = window.setInterval(() => {
      setLockRemainingSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(t);
  }, [lockRemainingSec]);

  const roleCopy = useMemo(
    () =>
      role === "admin"
        ? {
            title: "Control institucional seguro",
            subtitle:
              "Accede al panel de gestion de S.A.D.I con trazabilidad de ingresos y validacion de usuarios autorizados.",
            field: "Correo institucional",
            placeholder: "admin@sena.edu.co",
            hint: "Usa tu cuenta institucional registrada.",
            badge: "Acceso administrador",
          }
        : {
            title: "Ingreso de aprendices SENA",
            subtitle:
              "Valida tu identidad para consultar tus accesos y mantener la credencial activa en el sistema.",
            field: "Documento de identidad",
            placeholder: "Ingresa tu documento",
            hint: "Solo numeros (maximo 10 digitos).",
            badge: "Acceso aprendiz",
          },
    [role]
  );

  function onUsernameChange(raw: string) {
    if (role === "aprendiz") {
      setUsername(raw.replace(/\D/g, "").slice(0, 10));
      return;
    }
    setUsername(raw);
  }

  function onPasswordChange(raw: string) {
    setPassword(raw.slice(0, 20));
  }

  function validateLogin(): string | null {
    const user = username.trim();
    if (!user) return `Ingresa ${role === "admin" ? "tu correo institucional" : "tu documento"}.`;
    if (role === "admin" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) return "El correo no tiene un formato valido.";
    if (role === "aprendiz" && !/^\d{1,10}$/.test(user)) return "El documento debe contener solo numeros (maximo 10 digitos).";
    if (!password) return "Ingresa tu contrasena.";
    if (password.length > 20) return "La contrasena debe tener maximo 20 caracteres.";
    if (bloqueado) return `Cuenta bloqueada temporalmente. Intenta en ${lockRemainingSec}s.`;
    return null;
  }

  function roleForBackend() {
    return role === "admin" ? "admin" : "aprendiz";
  }

  function applyLockFromError(err: any) {
    const code = err?.response?.data?.code;
    const seconds = Number(err?.response?.data?.detail?.seconds_remaining || 0);
    if (code === "ACCOUNT_LOCKED_15MIN") {
      setLockRemainingSec(seconds > 0 ? seconds : 15 * 60);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateLogin();
    if (validationError) {
      setError(validationError);
      setLoginFailTick((v) => v + 1);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const tokenRes = await api.post("/api/token/", {
        username: username.trim(),
        password,
        expected_role: roleForBackend(),
      });
      saveTokens({ access: tokenRes.data.access, refresh: tokenRes.data.refresh });

      const meRes = await api.get<MeResponse>("/api/me/");
      const rol = meRes.data.usuario.rol;

      if (role === "admin" && !["admin", "superadmin", "admin_sede"].includes(rol)) {
        await clearTokens();
        setError("Este modulo solo permite credenciales de administrador.");
        setLoginFailTick((v) => v + 1);
        return;
      }

      if (role === "aprendiz" && rol !== "aprendiz") {
        await clearTokens();
        setError("Este modulo solo permite credenciales de aprendiz.");
        setLoginFailTick((v) => v + 1);
        return;
      }

      if (rol === "aprendiz") {
        router.replace("/aprendiz/inicio");
        return;
      }
      if (["admin", "superadmin", "admin_sede"].includes(rol)) {
        router.replace("/admin/usuarios");
        return;
      }

      await clearTokens();
      setError("El rol guarda no esta habilitado en la web. Usa la app movil para control de acceso.");
      setLoginFailTick((v) => v + 1);
    } catch (err: any) {
      applyLockFromError(err);
      setError(toErrorMessage(err, "Credenciales invalidas."));
      setLoginFailTick((v) => v + 1);
    } finally {
      setLoading(false);
    }
  }

  async function onPasskeyLogin() {
    if (!passkeySupported) {
      setError("Tu navegador no soporta Passkeys/WebAuthn.");
      return;
    }
    if (bloqueado) {
      setError(`Cuenta bloqueada temporalmente. Intenta en ${lockRemainingSec}s.`);
      return;
    }

    setError(null);
    setPasskeyLoading(true);
    try {
      const optionsRes = await api.post<PasskeyAuthOptionsResponse>("/api/auth/passkeys/auth/options/", {
        username: username.trim(),
        expected_role: roleForBackend(),
      });
      const options = optionsRes.data;

      const publicKey: PublicKeyCredentialRequestOptions = {
        challenge: stringToBytes(options.challenge),
        rpId: options.rp_id,
        timeout: options.timeout || 60000,
        userVerification: "preferred",
        allowCredentials: (options.allow_credentials || []).map((c) => ({
          type: "public-key",
          id: stringToBytes(c.credential_id),
          transports: c.transports as AuthenticatorTransport[] | undefined,
        })),
      };

      const assertion = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
      if (!assertion) {
        throw new Error("No fue posible obtener una credencial passkey.");
      }
      const credentialId = toBase64Url(assertion.rawId);

      const tokenRes = await api.post("/api/auth/passkeys/auth/verify/", {
        request_id: options.request_id,
        challenge: options.challenge,
        credential_id: credentialId,
        expected_role: roleForBackend(),
      });
      saveTokens({ access: tokenRes.data.access, refresh: tokenRes.data.refresh });

      const meRes = await api.get<MeResponse>("/api/me/");
      const rol = meRes.data.usuario.rol;
      if (rol === "aprendiz") {
        router.replace("/aprendiz/inicio");
      } else if (["admin", "superadmin", "admin_sede"].includes(rol)) {
        router.replace("/admin/usuarios");
      } else {
        await clearTokens();
        setError("La passkey no corresponde al modulo actual.");
      }
    } catch (err: any) {
      applyLockFromError(err);
      setError(toErrorMessage(err, "No se pudo iniciar con passkey."));
      setLoginFailTick((v) => v + 1);
    } finally {
      setPasskeyLoading(false);
    }
  }

  return (
    <AuthLayout role={role} title={roleCopy.title} subtitle={roleCopy.subtitle} badge={roleCopy.badge} gestureTick={loginFailTick}>
      <AuthCard className="p-5 md:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Iniciar sesion</h2>
            <p className="text-xs text-slate-500">Sistema de Administracion de Ingresos S.A.D.I</p>
          </div>
          <span
            className="rounded-full border border-white/70 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-600"
            style={{ background: "var(--auth-accent-soft)" }}
          >
            SENA
          </span>
        </div>

        <div className="mt-5">
          <RoleSwitch
            value={role}
            onChange={(nextRole) => {
              setRole(nextRole);
              setError(null);
              setUsername("");
            }}
          />
          <p className="mt-2 text-xs text-slate-600">
            {role === "admin"
              ? "Vista de gestion con enfoque en seguridad y monitoreo."
              : "Vista de aprendizaje para ingreso y validacion de identidad."}
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <AuthInput
            id="auth-username"
            label={roleCopy.field}
            placeholder={roleCopy.placeholder}
            value={username}
            onChange={(e) => onUsernameChange(e.target.value)}
            autoComplete={role === "admin" ? "username" : "off"}
            inputMode={role === "admin" ? "email" : "numeric"}
            maxLength={role === "admin" ? 80 : 10}
            error={null}
            hint={roleCopy.hint}
          />

          <div className="space-y-1.5">
            <label htmlFor="auth-password" className="block text-sm font-semibold text-slate-800">
              contrasena
            </label>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                className={styles.input}
                placeholder="********"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                autoComplete="current-password"
                maxLength={20}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          {bloqueado ? <p className={`${styles.status} ${styles.statusError}`}>Cuenta bloqueada. Intenta en {lockRemainingSec}s.</p> : null}
          {error ? <p className={`${styles.status} ${styles.statusError}`}>{error}</p> : null}

          <AuthButton type="submit" loading={loading} loadingLabel="Ingresando..." className="w-full" disabled={bloqueado || passkeyLoading}>
            Iniciar sesion
          </AuthButton>

          <AuthButton
            type="button"
            variant="secondary"
            className="w-full"
            onClick={onPasskeyLogin}
            loading={passkeyLoading}
            disabled={!passkeySupported || bloqueado || loading}
          >
            Iniciar con Passkey
          </AuthButton>

          <AuthButton type="button" variant="secondary" className="w-full" onClick={() => router.push("/password-recovery")}>
            Recuperar contrasena
          </AuthButton>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
