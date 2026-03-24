/**
 * Login web de S.A.D.I.
 *
 * Responsabilidad:
 * - Autenticar administradores o aprendices.
 * - Aplicar bloqueo temporal y flujo passkey.
 * - Mostrar estados de carga y error claros durante toda la autenticación.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearTokens, saveTokens } from "@/lib/auth";
import { toErrorMessage } from "@/lib/errors";
import { sanitizeDigits, validateDocument6to10 } from "@/lib/validators";
import { AuthButton, AuthCard, AuthInput, AuthLayout, RoleSwitch, type AuthRole } from "@/components/auth";
import styles from "@/components/auth/auth.module.css";

type MeResponse = {
  permitido: boolean;
  motivo: string | null;
  usuario: {
    id: number;
    username: string;
    rol: "superadmin" | "admin_sede" | "aprendiz" | "guarda";
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

/**
 * Pantalla principal de inicio de sesión web.
 */
export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<AuthRole>("admin");
  const [showPassword, setShowPassword] = useState(false);
  const [lockRemainingSec, setLockRemainingSec] = useState(0);
  const [passkeySupported, setPasskeySupported] = useState(false);

  const bloqueado = lockRemainingSec > 0;

  useEffect(() => {
    setPasskeySupported(typeof window !== "undefined" && "PublicKeyCredential" in window && !!navigator.credentials);
  }, []);

  useEffect(() => {
    if (lockRemainingSec <= 0) return;
    const timerId = window.setInterval(() => {
      setLockRemainingSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [lockRemainingSec]);

  const roleCopy = useMemo(
    () =>
      role === "admin"
        ? {
            title: "Control institucional seguro",
            subtitle:
              "Accede al panel de gestión de S.A.D.I. con trazabilidad de ingresos, revisión operativa y validación de usuarios autorizados.",
            field: "Usuario o correo",
            placeholder: "superadmin o admin@institucion.local",
            hint: "Puedes ingresar con tu nombre de usuario o con el correo administrativo.",
            badge: "Acceso administrador",
          }
        : {
            title: "Ingreso de aprendices",
            subtitle: "Valida tu identidad para consultar tus accesos, gestionar tus equipos y mantener tu credencial activa.",
            field: "Documento de identidad",
            placeholder: "Ingresa tu documento",
            hint: "Solo números entre 6 y 10 dígitos.",
            badge: "Acceso aprendiz",
          },
    [role]
  );

  function onUsernameChange(raw: string) {
    if (role === "aprendiz") {
      setUsername(sanitizeDigits(raw).slice(0, 10));
      return;
    }
    setUsername(raw);
  }

  function onPasswordChange(raw: string) {
    setPassword(raw);
  }

  /**
   * Valida los datos del formulario antes de enviar al backend.
   */
  function validateLogin(): string | null {
    const user = username.trim();
    if (!user) return `Ingresa ${role === "admin" ? "tu usuario o correo" : "tu documento"}.`;
    if (role === "admin" && user.length > 150) return "El usuario o correo supera el máximo permitido (150).";
    if (role === "aprendiz") {
      const docError = validateDocument6to10(user);
      if (docError) return docError;
    }
    if (!password) return "Ingresa tu contraseña.";
    if (bloqueado) return `Cuenta bloqueada temporalmente. Intenta en ${lockRemainingSec}s.`;
    return null;
  }

  function resolvePostLoginPath(currentRole: MeResponse["usuario"]["rol"]) {
    const nextPath =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") || "" : "";
    if (nextPath.startsWith("/") && !nextPath.startsWith("//")) return nextPath;
    if (currentRole === "aprendiz") return "/aprendiz/inicio";
    if (["superadmin", "admin_sede"].includes(currentRole)) return "/admin/usuarios";
    return "/login";
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

  /**
   * Envía credenciales por contraseña y redirige según el rol permitido.
   */
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateLogin();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const tokenRes = await api.post(
        "/api/token/",
        {
          username: username.trim(),
          password,
          expected_role: roleForBackend(),
          auth_transport: "cookie",
        },
        { timeout: 20000 }
      );
      saveTokens({ access: tokenRes.data.access, refresh: tokenRes.data.refresh || "" });

      const meRes = await api.get<MeResponse>("/api/me/", { timeout: 20000 });
      const currentRole = meRes.data.usuario.rol;

      if (role === "admin" && !["superadmin", "admin_sede"].includes(currentRole)) {
        await clearTokens();
        setError("Este módulo solo permite credenciales de administrador.");
        return;
      }

      if (role === "aprendiz" && currentRole !== "aprendiz") {
        await clearTokens();
        setError("Este módulo solo permite credenciales de aprendiz.");
        return;
      }

      if (currentRole === "aprendiz") {
        router.replace(resolvePostLoginPath(currentRole));
        return;
      }

      if (["superadmin", "admin_sede"].includes(currentRole)) {
        router.replace(resolvePostLoginPath(currentRole));
        return;
      }

      await clearTokens();
      setError("El rol de guarda no está habilitado en la web. Usa la app móvil para control de acceso.");
    } catch (err: any) {
      applyLockFromError(err);
      setError(toErrorMessage(err, "Credenciales inválidas."));
    } finally {
      setLoading(false);
    }
  }

  /**
   * Inicia sesión con passkey/WebAuthn cuando el navegador lo soporta.
   */
  async function onPasskeyLogin() {
    if (!passkeySupported) {
      setError("Tu navegador no soporta passkeys o WebAuthn.");
      return;
    }

    if (bloqueado) {
      setError(`Cuenta bloqueada temporalmente. Intenta en ${lockRemainingSec}s.`);
      return;
    }

    setError(null);
    setPasskeyLoading(true);
    try {
      const optionsRes = await api.post<PasskeyAuthOptionsResponse>(
        "/api/auth/passkeys/auth/options/",
        {
          username: username.trim(),
          expected_role: roleForBackend(),
        },
        { timeout: 20000 }
      );
      const options = optionsRes.data;

      const publicKey: PublicKeyCredentialRequestOptions = {
        challenge: stringToBytes(options.challenge),
        rpId: options.rp_id,
        timeout: options.timeout || 60000,
        userVerification: "preferred",
        allowCredentials: (options.allow_credentials || []).map((credential) => ({
          type: "public-key",
          id: stringToBytes(credential.credential_id),
          transports: credential.transports as AuthenticatorTransport[] | undefined,
        })),
      };

      const assertion = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
      if (!assertion) {
        throw new Error("No fue posible obtener una credencial passkey.");
      }

      const credentialId = toBase64Url(assertion.rawId);
      const tokenRes = await api.post(
        "/api/auth/passkeys/auth/verify/",
        {
          request_id: options.request_id,
          challenge: options.challenge,
          credential_id: credentialId,
          expected_role: roleForBackend(),
          auth_transport: "cookie",
        },
        { timeout: 20000 }
      );
      saveTokens({ access: tokenRes.data.access, refresh: tokenRes.data.refresh || "" });

      const meRes = await api.get<MeResponse>("/api/me/", { timeout: 20000 });
      const currentRole = meRes.data.usuario.rol;

      if (currentRole === "aprendiz") {
        router.replace(resolvePostLoginPath(currentRole));
      } else if (["superadmin", "admin_sede"].includes(currentRole)) {
        router.replace(resolvePostLoginPath(currentRole));
      } else {
        await clearTokens();
        setError("La passkey no corresponde al módulo actual.");
      }
    } catch (err: any) {
      applyLockFromError(err);
      setError(toErrorMessage(err, "No se pudo iniciar con passkey."));
    } finally {
      setPasskeyLoading(false);
    }
  }

  return (
    <AuthLayout role={role} title={roleCopy.title} subtitle={roleCopy.subtitle} badge={roleCopy.badge}>
      <AuthCard className="p-4 md:p-5 xl:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Portal de acceso</p>
            <h2 className="text-[1.75rem] font-bold leading-none tracking-tight text-[color:var(--foreground)]">Iniciar sesión</h2>
            <p className="max-w-md text-sm leading-snug text-[color:var(--text-muted)]">
              Elige tu perfil, valida tu identidad y entra al módulo correcto con una interfaz clara, ordenada y lista para trabajar.
            </p>
          </div>

          <span
            className="inline-flex w-fit shrink-0 rounded-full border border-[color:var(--surface-border)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-soft)] shadow-sm"
            style={{ background: "var(--auth-accent-soft)" }}
          >
            Sesión segura
          </span>
        </div>

        <div className="mt-4 rounded-[1.2rem] border border-[color:var(--surface-border)] bg-[color:var(--surface-muted)]/55 p-3.5">
          <RoleSwitch
            value={role}
            onChange={(nextRole) => {
              setRole(nextRole);
              setError(null);
              setUsername("");
            }}
          />
          <p className="mt-2.5 text-sm leading-snug text-[color:var(--text-soft)]">
            {role === "admin"
              ? "Vista de gestión con foco en seguridad, trazabilidad y operación por sede."
              : "Vista personal para validar identidad, revisar accesos y gestionar equipos."}
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <AuthInput
            id="auth-username"
            label={roleCopy.field}
            placeholder={roleCopy.placeholder}
            value={username}
            onChange={(e) => onUsernameChange(e.target.value)}
            autoComplete={role === "admin" ? "username" : "off"}
            inputMode={role === "admin" ? "text" : "numeric"}
            type="text"
            pattern={role === "admin" ? undefined : "[0-9]*"}
            maxLength={role === "admin" ? 150 : 10}
            error={null}
            hint={roleCopy.hint}
          />

          <div className="space-y-1.5">
            <label htmlFor="auth-password" className="block text-sm font-semibold text-[color:var(--foreground)]">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                className={styles.input}
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-[color:var(--text-soft)] transition hover:bg-[color:var(--surface-muted)] focus-visible:outline-none"
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            <p className="text-xs leading-relaxed text-[color:var(--text-muted)]">
              La contraseña se valida de forma segura y no se almacena en el navegador.
            </p>
          </div>

          {bloqueado ? <p className={`${styles.status} ${styles.statusError}`}>Cuenta bloqueada. Intenta en {lockRemainingSec}s.</p> : null}
          {error ? <p className={`${styles.status} ${styles.statusError}`}>{error}</p> : null}

           <div className="space-y-2.5 pt-1">
            <AuthButton type="submit" loading={loading} loadingLabel="Ingresando..." className="w-full" disabled={bloqueado || passkeyLoading}>
              Entrar al sistema
            </AuthButton>

            <AuthButton
              type="button"
              variant="secondary"
              className="w-full"
              onClick={onPasskeyLogin}
              loading={passkeyLoading}
              disabled={!passkeySupported || bloqueado || loading}
            >
              Entrar con passkey
            </AuthButton>

            <AuthButton type="button" variant="ghost" className="w-full" onClick={() => router.push("/password-recovery")}>
              Recuperar contraseña
            </AuthButton>
          </div>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
