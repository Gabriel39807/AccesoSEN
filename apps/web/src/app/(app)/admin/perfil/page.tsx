"use client";

import Link from "next/link";

import { useMe } from "@/hooks/useMe";
import { IconArrowRight, IconClock, IconHistory, IconLaptop, IconShield, IconUser } from "@/components/aprendiz/dashboard/DashboardIcons";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function InfoCard({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <article
      className={cx(
        "rounded-[1.5rem] border p-4 shadow-[0_10px_26px_rgba(2,6,23,0.05)]",
        highlight ? "border-emerald-200/80 bg-emerald-50/80" : "border-white/80 bg-white/80"
      )}
    >
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-zinc-900">{value || "-"}</p>
    </article>
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
      <section className="overflow-hidden rounded-[2rem] border border-white/80 bg-[linear-gradient(135deg,rgba(5,150,105,0.96),rgba(6,95,70,0.92)_55%,rgba(15,23,42,0.94))] p-6 text-white shadow-[0_18px_50px_rgba(2,6,23,0.18)]">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr),320px] xl:items-end">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-emerald-100/80">Mi perfil</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight xl:text-[2.75rem]">{fullName}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-emerald-50/85">
              Vista ejecutiva de tu cuenta administrativa, tu alcance operativo y accesos rápidos al centro de gestión.
            </p>
          </div>

          <div className="rounded-[1.6rem] border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-white shadow-inner shadow-black/10">
                <IconUser className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-bold">{fullName}</p>
                <p className="truncate text-xs uppercase tracking-[0.12em] text-emerald-100/75">{me?.rol ?? "admin"}</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-xs text-emerald-50/80">
              El backend sigue siendo la fuente de verdad para permisos, sedes y trazabilidad.
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Usuario" value={me?.username ?? "-"} />
        <InfoCard label="Correo" value={me?.email ?? "-"} />
        <InfoCard label="Rol" value={me?.rol ?? "-"} highlight />
        <InfoCard label="Sede principal" value={me?.sede_principal ?? "Global / no asignada"} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr),380px]">
        <article className="rounded-[1.75rem] border border-white/80 bg-white/80 p-5 shadow-[0_10px_30px_rgba(2,6,23,0.06)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">Accesos rápidos</p>
              <h2 className="mt-2 text-2xl font-bold text-zinc-900">Atajos administrativos</h2>
            </div>
            <Link
              href="/admin/inicio"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700 transition hover:bg-emerald-100"
            >
              Volver al dashboard
            </Link>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {shortcuts.map((shortcut) => (
              <Link
                key={shortcut.href}
                href={shortcut.href}
                className="group rounded-[1.45rem] border border-zinc-100 bg-gradient-to-br from-white to-zinc-50/80 p-4 shadow-[0_8px_22px_rgba(2,6,23,0.04)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_12px_26px_rgba(5,150,105,0.08)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    {shortcut.icon}
                  </div>
                  <IconArrowRight className="h-4 w-4 text-zinc-400 transition group-hover:text-emerald-600" />
                </div>
                <h3 className="mt-4 text-base font-bold text-zinc-900">{shortcut.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{shortcut.description}</p>
              </Link>
            ))}
          </div>
        </article>

        <div className="space-y-6">
          <article className="rounded-[1.75rem] border border-white/80 bg-white/80 p-5 shadow-[0_10px_30px_rgba(2,6,23,0.06)] backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                <IconShield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-sky-700">Seguridad</p>
                <h3 className="mt-1 text-xl font-bold text-zinc-900">Estado de la cuenta</h3>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4">
                <p className="text-sm font-semibold text-zinc-900">Aislamiento por rol</p>
                <p className="mt-1 text-sm text-zinc-600">Tus vistas y acciones administrativas están sujetas al backend y a la sede asignada.</p>
              </div>
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4">
                <p className="text-sm font-semibold text-zinc-900">Auditoría activa</p>
                <p className="mt-1 text-sm text-zinc-600">Las operaciones críticas deben quedar registradas y con trazabilidad institucional.</p>
              </div>
            </div>
          </article>

          <article className="rounded-[1.75rem] border border-white/80 bg-white/80 p-5 shadow-[0_10px_30px_rgba(2,6,23,0.06)] backdrop-blur-xl">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-zinc-500">Resumen</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-2xl bg-zinc-50/80 px-4 py-3">
                <span className="text-sm text-zinc-600">Documento</span>
                <span className="text-sm font-semibold text-zinc-900">{me?.documento ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-zinc-50/80 px-4 py-3">
                <span className="text-sm text-zinc-600">Estado</span>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">
                  {me?.estado ?? "activo"}
                </span>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
