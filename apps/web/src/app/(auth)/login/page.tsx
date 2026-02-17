"use client";

import { useMemo, useState } from "react";
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
    rol: "admin" | "aprendiz" | "guarda";
  };
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<AuthRole>("admin");
  const [showPassword, setShowPassword] = useState(false);

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
            hint: "Debes usar el documento asociado a tu cuenta.",
            badge: "Acceso aprendiz",
          },
    [role],
  );

  function validateLogin(): string | null {
    if (!username.trim()) return `Ingresa ${role === "admin" ? "tu correo institucional" : "tu documento"}.`;
    if (role === "admin" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username.trim())) return "El correo no tiene un formato valido.";
    if (role === "aprendiz" && !/^\d{5,20}$/.test(username.trim())) return "El documento debe contener solo numeros (5 a 20 digitos).";
    if (!password) return "Ingresa tu contraseña.";
    return null;
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
      const tokenRes = await api.post("/api/token/", { username, password });
      saveTokens({ access: tokenRes.data.access, refresh: tokenRes.data.refresh });

      const meRes = await api.get<MeResponse>("/api/me/");
      const rol = meRes.data.usuario.rol;
      if (rol === "admin") router.replace("/admin/usuarios");
      else if (rol === "aprendiz") router.replace("/aprendiz/inicio");
      else {
        await clearTokens();
        setError("El rol guarda no esta habilitado en la web. Usa la app movil para control de acceso.");
      }
    } catch (err: unknown) {
      setError(toErrorMessage(err, "Credenciales invalidas."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout role={role} title={roleCopy.title} subtitle={roleCopy.subtitle} badge={roleCopy.badge}>
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
            onChange={(e) => setUsername(e.target.value)}
            autoComplete={role === "admin" ? "username" : "off"}
            inputMode={role === "admin" ? "email" : "numeric"}
            error={null}
            hint={roleCopy.hint}
          />

          <div className="space-y-1.5">
            <label htmlFor="auth-password" className="block text-sm font-semibold text-slate-800">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                className={styles.input}
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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

          {error ? <p className={`${styles.status} ${styles.statusError}`}>{error}</p> : null}

          <AuthButton type="submit" loading={loading} loadingLabel="Ingresando..." className="w-full">
            Iniciar sesion
          </AuthButton>

          <AuthButton type="button" variant="secondary" className="w-full" onClick={() => router.push("/password-recovery")}>
            Recuperar contraseña
          </AuthButton>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
