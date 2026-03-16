"use client";

import { motion } from "framer-motion";

export default function BestEmployeeWidget() {
  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="flex flex-col rounded-3xl border border-white/60 bg-white/70 p-5 shadow-[0_10px_30px_rgba(2,6,23,0.06)] backdrop-blur-xl"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-extrabold text-zinc-900">Responsable destacado</h3>
        <select className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50">
          <option>Este mes</option>
          <option>Mes anterior</option>
        </select>
      </div>

      <div className="mt-5 flex flex-col gap-5 sm:flex-row">
        <div className="relative h-48 w-full shrink-0 overflow-hidden rounded-2xl bg-zinc-100 sm:w-40">
          <div className="absolute inset-0 bg-gradient-to-tr from-sky-200/50 to-cyan-100/30" />
          <svg
            className="absolute inset-0 h-full w-full text-zinc-300"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <div className="absolute bottom-2 left-2 right-2 rounded-xl border border-white/40 bg-white/80 px-3 py-2 text-xs backdrop-blur-md">
            <p className="font-bold text-zinc-900">Coordinación central</p>
            <p className="text-[10px] text-zinc-500">Seguimiento operativo continuo</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center space-y-4">
          <div>
            <p className="text-xs font-semibold text-zinc-500">Rol sugerido</p>
            <p className="font-bold text-zinc-900">Administrador de sede</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500">Fortaleza</p>
            <p className="font-bold text-zinc-900">Trazabilidad de accesos y equipos</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-zinc-500">Cobertura</p>
              <p className="text-sm font-bold text-zinc-900">Revisión diaria</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500">Prioridad</p>
              <p className="text-sm font-bold text-zinc-900">Alta</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500">Enfoque</p>
            <p className="font-bold text-zinc-900">Consistencia operativa por sede</p>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
