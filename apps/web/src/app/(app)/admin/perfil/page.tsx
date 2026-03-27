"use client";

import Link from "next/link";

import { useMe } from "@/hooks/useMe";
import { IconArrowRight, IconClock, IconHistory, IconLaptop, IconShield, IconUser } from "@/components/aprendiz/dashboard/DashboardIcons";

function SecurityItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[1.35rem] border border-zinc-100 bg-zinc-50/85 px-4 py-4">
      <p className="text-sm font-semibold text-zinc-900">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{description}</p>
    </div>
  );
}

export default function AdminPerfilPage() {
  const { me, loadingMe } = useMe();

  if (loadingMe) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center">
        <p className="animate-pulse text-sm font-medium text-zinc-500">Cargando perfil administrativo...</p>
      </div>
    );
  }

  const fullName =
    me?.first_name || me?.last_name
      ? `${me?.first_name ?? ""} ${me?.last_name ?? ""}`.trim()
      : me?.username ?? "Administrador";

  const shortcuts = [
    {
      href: "/admin/usuarios",
      title: "Gestionar usuarios",
      description: "Controla altas, roles y estados del personal institucional.",
      icon: <IconUser className="h-5 w-5" />,
    },
    {
      href: "/admin/equipos",
      title: "Revisar equipos",
      description: "Consulta solicitudes y aprobaciones pendientes por sede.",
      icon: <IconLaptop className="h-5 w-5" />,
    },
    {
      href: "/admin/accesos",
      title: "Auditar accesos",
      description: "Monitorea entradas, salidas y trazabilidad reciente.",
      icon: <IconHistory className="h-5 w-5" />,
    },
    {
      href: "/admin/turnos",
      title: "Supervisar turnos",
      description: "Valida cobertura de guardas y continuidad operativa.",
      icon: <IconClock className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[1.8rem] border border-white/80 bg-[linear-gradient(135deg,rgba(5,150,105,0.96),rgba(6,95,70,0.92)_54%,rgba(15,23,42,0.94))] px-5 py-4 text-white shadow-[0_16px_36px_rgba(2,6,23,0.15)] lg:px-6 lg:py-4">
        <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1.25fr),300px] xl:items-center">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-emerald-100/80">Mi perfil</p>
              <div className="space-y-1.5">
                <h1 className="text-[1.9rem] font-extrabold tracking-tight xl:text-[2.15rem]">{fullName}</h1>
                <p className="max-w-2xl text-sm leading-relaxed text-emerald-50/82">
                  Vista ejecutiva de tu cuenta administrativa, tu alcance operativo y los accesos clave del entorno de gestion.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <div className="rounded-full border border-white/12 bg-black/10 px-3.5 py-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-100/70">Rol administrativo</p>
                <p className="mt-1 text-sm font-semibold text-white">{me?.rol ?? "admin"}</p>
              </div>
              <div className="rounded-full border border-white/12 bg-black/10 px-3.5 py-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-100/70">Cobertura principal</p>
                <p className="mt-1 text-sm font-semibold text-white">{me?.sede_principal ?? "Global / no asignada"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-white/15 bg-white/10 p-3.5 shadow-inner shadow-black/10 backdrop-blur-sm">
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-white/15 text-white shadow-inner shadow-black/10">
                <IconUser className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-100/70">Cuenta administrativa</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-[1rem] border border-white/10 bg-black/10 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100/65">Usuario</p>
                    <p className="mt-1 truncate text-sm font-semibold text-white">{me?.username ?? "-"}</p>
                  </div>
                  <div className="rounded-[1rem] border border-white/10 bg-black/10 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100/65">Correo</p>
                    <p className="mt-1 truncate text-sm font-semibold text-white">{me?.email ?? "-"}</p>
                  </div>
                  <div className="rounded-[1rem] border border-white/10 bg-black/10 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100/65">Estado</p>
                    <p className="mt-1 text-sm font-semibold text-white">{me?.estado ?? "activo"}</p>
                  </div>
                  <div className="rounded-[1rem] border border-white/10 bg-black/10 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100/65">Documento</p>
                    <p className="mt-1 truncate text-sm font-semibold text-white">{me?.documento ?? "-"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr),390px]">
        <article className="rounded-[1.85rem] border border-white/80 bg-white/88 p-6 shadow-[0_14px_34px_rgba(2,6,23,0.06)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">Accesos rápidos</p>
              <div>
                <h2 className="text-2xl font-bold text-zinc-900">Atajos administrativos</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Accede a los puntos de gestión que concentran tu operación diaria.
                </p>
              </div>
            </div>
            <Link
              href="/admin/inicio"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700 transition hover:bg-emerald-100"
            >
              Volver al dashboard
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {shortcuts.map((shortcut) => (
              <Link
                key={shortcut.href}
                href={shortcut.href}
                className="group rounded-[1.55rem] border border-zinc-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,247,245,0.92))] p-5 shadow-[0_10px_24px_rgba(2,6,23,0.04)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_14px_28px_rgba(5,150,105,0.08)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-[1.1rem] bg-emerald-100 text-emerald-700">
                    {shortcut.icon}
                  </div>
                  <div className="rounded-full bg-zinc-100 p-2 text-zinc-400 transition group-hover:bg-emerald-50 group-hover:text-emerald-600">
                    <IconArrowRight className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-5">
                  <h3 className="text-base font-bold text-zinc-900">{shortcut.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">{shortcut.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </article>

        <div>
          <article className="rounded-[1.85rem] border border-white/80 bg-white/88 p-6 shadow-[0_14px_34px_rgba(2,6,23,0.06)] backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                <IconShield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-sky-700">Seguridad</p>
                <h3 className="mt-1 text-xl font-bold text-zinc-900">Estado de la cuenta</h3>
                <p className="mt-1 text-sm text-zinc-600">Resumen de condiciones operativas y trazabilidad de la cuenta.</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <SecurityItem
                title="Aislamiento por rol"
                description="Tus vistas y acciones administrativas están sujetas al backend y a la sede asignada."
              />
              <SecurityItem
                title="Auditoría activa"
                description="Las operaciones críticas deben quedar registradas y con trazabilidad institucional."
              />
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
