"use client";

import { motion } from "framer-motion";

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.15
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, x: 20 },
    show: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 300 } }
};

export default function ScheduleWidget() {
    const schedule = [
        { time: "09:00", title: "Team Sync - Up (Marketing)", period: "09:00 - 11:00", type: "meeting" },
        { time: "11:00", title: "Lunch Break", period: "", type: "break" },
        { time: "14:00", title: "Interview with Sarah Lee", period: "(Developer)", type: "meeting" },
        { time: "15:00", title: "Monthly Performance Review", period: "(Sales Team)", type: "meeting" },
    ];

    return (
        <article className="flex flex-col rounded-3xl border border-white/60 bg-white/70 p-5 shadow-[0_10px_30px_rgba(2,6,23,0.06)] backdrop-blur-xl">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-extrabold text-zinc-900">Today&apos;s Schedule</h3>
                <button className="text-xs font-semibold text-sky-600 hover:text-sky-700 transition">
                    3 Schedule
                </button>
            </div>

            <div className="flex justify-between items-center mb-6 overflow-hidden">
                {["1", "2", "3", "4", "5", "6", "7"].map((day, i) => (
                    <div key={day} className="flex flex-col items-center">
                        <span className="text-[10px] font-medium text-zinc-400 mb-1">
                            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}
                        </span>
                        <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${day === "3"
                                ? "bg-sky-600 text-white shadow-md shadow-sky-500/30 scale-110"
                                : "bg-transparent text-zinc-700 hover:bg-zinc-100"
                                }`}
                        >
                            {day}
                        </div>
                    </div>
                ))}
            </div>

            <div className="text-xs font-bold text-zinc-800 mb-4">September 03, 2025</div>

            <motion.div
                variants={container}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="flex flex-col space-y-4"
            >
                {schedule.map((item, i) => (
                    <motion.div variants={itemVariants} key={i} className="flex gap-4">
                        <div className="w-10 text-xs font-medium text-zinc-400 shrink-0 text-right mt-0.5">
                            {item.time}
                        </div>
                        {item.type === "break" ? (
                            <div className="flex-1 rounded-full border border-zinc-200 bg-zinc-50 py-1.5 text-center text-xs font-semibold text-sky-600">
                                {item.title}
                            </div>
                        ) : (
                            <div className="relative flex-1 pl-4 pb-1 group cursor-pointer">
                                <motion.div
                                    className="absolute left-0 top-1.5 h-full w-[2px] rounded-full bg-sky-200"
                                    whileHover={{ width: 4, left: -1, backgroundColor: "#38bdf8" }}
                                />
                                <div className="absolute left-[-3px] top-1 h-2 w-2 rounded-full border-2 border-white bg-sky-500 shadow-sm transition-transform group-hover:scale-125" />
                                <h4 className="text-xs font-bold text-zinc-900 transition-colors group-hover:text-sky-600">{item.title}</h4>
                                {item.period && (
                                    <p className="mt-0.5 text-[10px] font-medium text-zinc-500">{item.period}</p>
                                )}
                                {i === 0 && (
                                    <div className="mt-2 flex -space-x-1.5">
                                        <img className="h-5 w-5 rounded-full border border-white transition-transform hover:z-10 hover:scale-110" src="https://ui-avatars.com/api/?name=A&background=random" alt="" />
                                        <img className="h-5 w-5 rounded-full border border-white transition-transform hover:z-10 hover:scale-110" src="https://ui-avatars.com/api/?name=B&background=random" alt="" />
                                        <img className="h-5 w-5 rounded-full border border-white transition-transform hover:z-10 hover:scale-110" src="https://ui-avatars.com/api/?name=C&background=random" alt="" />
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                ))}
            </motion.div>
        </article>
    );
}
