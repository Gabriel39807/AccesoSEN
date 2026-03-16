"use client";

import { motion } from "framer-motion";

const attendeeBadges = ["A", "S", "G"];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: 20 },
  show: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 300 } },
};

export default function ScheduleWidget() {
  const schedule = [
    { time: "07:00", title: "Apertura de jornada", period: "07:00 - 08:00", type: "meeting" },
    { time: "10:30", title: "Pausa operativa", period: "", type: "break" },
    { time: "13:00", title: "Revisión de accesos críticos", period: "Sede principal", type: "meeting" },
    { time: "16:00", title: "Cierre y validación de turnos", period: "Control administrativo", type: "meeting" },
  ];

  return (
    <article className="flex flex-col rounded-3xl border border-white/60 bg-white/70 p-5 shadow-[0_10px_30px_rgba(2,6,23,0.06)] backdrop-blur-xl">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-base font-extrabold text-zinc-900">Agenda del día</h3>
        <button className="text-xs font-semibold text-sky-600 transition hover:text-sky-700">
          4 bloques
        </button>
      </div>

      <div className="mb-6 flex items-center justify-between overflow-hidden">
        {["1", "2", "3", "4", "5", "6", "7"].map((day, i) => (
          <div key={day} className="flex flex-col items-center">
            <span className="mb-1 text-[10px] font-medium text-zinc-400">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][i]}
            </span>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                day === "3"
                  ? "scale-110 bg-sky-600 text-white shadow-md shadow-sky-500/30"
                  : "bg-transparent text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              {day}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 text-xs font-bold text-zinc-800">Miércoles, 3 de septiembre de 2025</div>

      <motion.div
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        className="flex flex-col space-y-4"
      >
        {schedule.map((item, i) => (
          <motion.div variants={itemVariants} key={i} className="flex gap-4">
            <div className="mt-0.5 w-10 shrink-0 text-right text-xs font-medium text-zinc-400">
              {item.time}
            </div>
            {item.type === "break" ? (
              <div className="flex-1 rounded-full border border-zinc-200 bg-zinc-50 py-1.5 text-center text-xs font-semibold text-sky-600">
                {item.title}
              </div>
            ) : (
              <div className="group relative flex-1 cursor-pointer pb-1 pl-4">
                <motion.div
                  className="absolute left-0 top-1.5 h-full w-[2px] rounded-full bg-sky-200"
                  whileHover={{ width: 4, left: -1, backgroundColor: "#38bdf8" }}
                />
                <div className="absolute left-[-3px] top-1 h-2 w-2 rounded-full border-2 border-white bg-sky-500 shadow-sm transition-transform group-hover:scale-125" />
                <h4 className="text-xs font-bold text-zinc-900 transition-colors group-hover:text-sky-600">
                  {item.title}
                </h4>
                {item.period ? (
                  <p className="mt-0.5 text-[10px] font-medium text-zinc-500">{item.period}</p>
                ) : null}
                {i === 0 ? (
                  <div className="mt-2 flex -space-x-1.5">
                    {attendeeBadges.map((badge) => (
                      <span
                        key={badge}
                        aria-label={`Responsable ${badge}`}
                        className="flex h-5 w-5 items-center justify-center rounded-full border border-white bg-gradient-to-br from-sky-400 to-cyan-500 text-[9px] font-extrabold text-white transition-transform hover:z-10 hover:scale-110"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </motion.div>
        ))}
      </motion.div>
    </article>
  );
}
