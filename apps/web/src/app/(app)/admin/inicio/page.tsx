"use client";

import BestEmployeeWidget from "@/components/admin/dashboard/BestEmployeeWidget";
import OverviewCards from "@/components/admin/dashboard/OverviewCards";
import ProgressWidget from "@/components/admin/dashboard/ProgressWidget";
import ScheduleWidget from "@/components/admin/dashboard/ScheduleWidget";
import { useMe } from "@/hooks/useMe";

function currentDateLabel() {
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export default function AdminInicioPage() {
  const { me, loadingMe } = useMe();

  if (loadingMe) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="animate-pulse font-medium text-zinc-500">Cargando panel...</p>
      </div>
    );
  }

  const nombre = me?.first_name || me?.username || "Administrador";

  return (
    <div className="flex flex-col space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(12,74,110,0.92)_48%,rgba(8,145,178,0.82))] p-6 text-white shadow-[0_18px_50px_rgba(2,6,23,0.18)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-cyan-100/80">Centro operativo</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-none tracking-tight">Bienvenido, {nombre}</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-cyan-50/85">
              Supervisa usuarios, accesos, equipos y turnos desde una vista más clara y priorizada para la operación diaria.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-100/75">Jornada</p>
              <p className="mt-1 text-sm font-semibold">{currentDateLabel()}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-100/75">Enfoque</p>
              <p className="mt-1 text-sm font-semibold">Monitoreo institucional y trazabilidad por sede</p>
            </div>
          </div>
        </div>
      </section>

      <OverviewCards />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-8">
          <div className="rounded-[1.75rem] border border-white/80 bg-white/75 p-5 shadow-[0_10px_30px_rgba(2,6,23,0.06)] backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-sky-700">Acciones rápidas</p>
                <h2 className="mt-2 text-2xl font-bold text-zinc-900">Prioridades del día</h2>
              </div>
              <p className="max-w-sm text-sm text-zinc-500">
                Concentra las tareas más frecuentes sin mezclar mensajes genéricos ni widgets ajenos al producto.
              </p>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {[
                { title: "Revisar accesos", detail: "Valida novedades recientes y confirma consistencia por sede." },
                { title: "Gestionar equipos", detail: "Aprueba o rechaza solicitudes pendientes con trazabilidad." },
                { title: "Organizar turnos", detail: "Confirma cobertura operativa y cambios del día." },
              ].map((item) => (
                <article
                  key={item.title}
                  className="rounded-2xl border border-sky-100/80 bg-gradient-to-br from-white to-sky-50/70 p-4 shadow-[0_8px_20px_rgba(2,6,23,0.04)]"
                >
                  <h3 className="text-base font-bold text-zinc-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">{item.detail}</p>
                </article>
              ))}
            </div>
          </div>

          <BestEmployeeWidget />
          <ProgressWidget />
        </div>

        <div className="flex flex-col gap-6 lg:col-span-4">
          <article className="rounded-[1.75rem] border border-white/80 bg-white/75 p-5 shadow-[0_10px_30px_rgba(2,6,23,0.06)] backdrop-blur-xl">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-sky-700">Estado operativo</p>
            <h3 className="mt-2 text-2xl font-bold text-zinc-900">Lectura rápida</h3>
            <div className="mt-5 space-y-4">
              {[
                ["Cobertura", "Turnos distribuidos y monitoreados en tiempo real."],
                ["Trazabilidad", "Cada acción crítica mantiene auditoría visible."],
                ["Aislamiento", "La información debe respetar sede y rol sin excepciones."],
              ].map(([title, detail]) => (
                <div key={title} className="rounded-2xl border border-zinc-100 bg-white/90 p-4">
                  <div className="text-sm font-semibold text-zinc-900">{title}</div>
                  <div className="mt-1 text-sm text-zinc-600">{detail}</div>
                </div>
              ))}
            </div>
          </article>

          <ScheduleWidget />
        </div>
      </section>
    </div>
  );
}
