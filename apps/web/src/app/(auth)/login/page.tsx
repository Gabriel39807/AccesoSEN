/**
 * Login web de SADI.
 *
 * Responsabilidad:
 * - Autenticar administradores o aprendices.
 * - Aplicar bloqueo temporal y flujo passkey.
 * - Mostrar estados de carga y error claros durante toda la autenticacion.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, KeyRound, LockKeyhole, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { clearTokens, saveTokens } from "@/lib/auth";
import { toErrorMessage } from "@/lib/errors";
import { sanitizeDigits, validateDocument6to10 } from "@/lib/validators";
import { AuthButton, AuthCard, AuthLayout, RoleSwitch, type AuthRole } from "@/components/auth";
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
            title: "Iniciar sesión",
            subtitle: "Selecciona tu rol, ingresa tus credenciales y accede al sistema.",
            field: "Usuario o correo",
            placeholder: "ejemplo@correo.com",
            badge: "Acceso administrador",
          }
        : {
            title: "Iniciar sesión",
            subtitle: "Selecciona tu rol, ingresa tus credenciales y accede al sistema.",
            field: "Documento institucional",
            placeholder: "Ingresa tu documento",
            badge: "Acceso estudiante",
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

  function validateLogin(): string | null {
    const user = username.trim();
    if (!user) return `Ingresa ${role === "admin" ? "tu usuario o correo" : "tu documento"}.`;
    if (role === "admin" && user.length > 150) return "El usuario o correo supera el maximo permitido (150).";
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
        setError("Este modulo solo permite credenciales de administrador.");
        return;
      }

      if (role === "aprendiz" && currentRole !== "aprendiz") {
        await clearTokens();
        setError("Este modulo solo permite credenciales de estudiante.");
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
      setError("El rol de guarda no esta habilitado en la web. Usa la app movil para control de acceso.");
    } catch (err: any) {
      applyLockFromError(err);
      setError(toErrorMessage(err, "Credenciales invalidas."));
    } finally {
      setLoading(false);
    }
  }

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
        setError("La passkey no corresponde al modulo actual.");
      }
    } catch (err: any) {
      applyLockFromError(err);
      setError(toErrorMessage(err, "No se pudo iniciar con passkey."));
    } finally {
      setPasskeyLoading(false);
    }
  }

  return (
    <AuthLayout role={role}>
      <AuthCard className="w-full p-5 md:p-6 xl:p-6">
        <div className="space-y-4.5">
          <div className="space-y-2">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[color:var(--auth-accent)]">{roleCopy.badge}</p>
            <h2 className="text-[1.8rem] font-extrabold leading-none tracking-tight text-[color:var(--foreground)] md:text-[1.95rem]">Iniciar sesión</h2>
            <p className="max-w-md text-sm leading-5.5 text-[color:var(--text-muted)]">
              Selecciona tu rol, valida tus credenciales y entra al entorno institucional correspondiente.
            </p>
          </div>

          <RoleSwitch
            value={role}
            onChange={(nextRole) => {
              setRole(nextRole);
              setError(null);
              setUsername("");
            }}
          />

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="auth-username" className="block text-sm font-semibold text-[color:var(--foreground)]">
                {roleCopy.field}
              </label>
              <div className={styles.fieldShell}>
                <span className={styles.fieldIconSlot}>
                  <UserRound className="h-4 w-4" strokeWidth={2.2} />
                </span>
                <input
                  id="auth-username"
                  className={styles.fieldInput}
                  placeholder={roleCopy.placeholder}
                  value={username}
                  onChange={(e) => onUsernameChange(e.target.value)}
                  autoComplete={role === "admin" ? "username" : "off"}
                  inputMode={role === "admin" ? "text" : "numeric"}
                  type="text"
                  pattern={role === "admin" ? undefined : "[0-9]*"}
                  maxLength={role === "admin" ? 150 : 10}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <label htmlFor="auth-password" className="block text-sm font-semibold text-[color:var(--foreground)]">
                  Contraseña
                </label>
              </div>

              <div className={`${styles.fieldShell} ${styles.fieldShellWithAction}`}>
                <span className={styles.fieldIconSlot}>
                  <LockKeyhole className="h-4 w-4" strokeWidth={2.1} />
                </span>
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  className={styles.fieldInput}
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className={styles.fieldAction}
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>

              <div className="flex justify-end pt-0.5">
                <button
                  type="button"
                  className="text-xs font-semibold text-[color:var(--auth-accent)] transition hover:opacity-80"
                  onClick={() => router.push("/password-recovery")}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </div>

            {bloqueado ? <p className={`${styles.status} ${styles.statusError}`}>Cuenta bloqueada. Intenta en {lockRemainingSec}s.</p> : null}
            {error ? <p className={`${styles.status} ${styles.statusError}`}>{error}</p> : null}

            <div className="space-y-3 pt-0.5">
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
                <span className="inline-flex items-center gap-2">
                  <Fingerprint className="h-4 w-4" strokeWidth={2.1} />
                  Entrar con passkey
                </span>
              </AuthButton>

              <div className="flex items-center justify-center gap-2 pt-0.5 text-center text-[11px] text-[color:var(--text-faint)]">
                <KeyRound className="h-3.5 w-3.5" strokeWidth={2.1} />
                Acceso exclusivo para personal autorizado
              </div>
            </div>
          </form>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}



