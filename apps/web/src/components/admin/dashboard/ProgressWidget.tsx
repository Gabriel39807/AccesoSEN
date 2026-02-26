"use client";

import { motion } from "framer-motion";

export default function ProgressWidget() {
    return (
        <article className="flex flex-col rounded-3xl border border-white/60 bg-white/70 p-5 shadow-[0_10px_30px_rgba(2,6,23,0.06)] backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-extrabold text-zinc-900">Onboarding Task</h3>
                <button className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100/50 hover:bg-zinc-200/50 transition">
                    <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                    </svg>
                </button>
            </div>

            <div className="mb-3 h-3 w-full overflow-hidden rounded-full bg-zinc-100">
                <div className="flex h-full w-full space-x-0.5">
                    <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: "60%" }}
                        transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                        viewport={{ once: true }}
                        className="h-full rounded-l-full bg-sky-600"
                    />
                    <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: "20%" }}
                        transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                        viewport={{ once: true }}
                        className="h-full bg-sky-400"
                    />
                    <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: "10%" }}
                        transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                        viewport={{ once: true }}
                        className="h-full bg-zinc-300"
                    />
                    <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: "10%" }}
                        transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                        viewport={{ once: true }}
                        className="h-full rounded-r-full bg-zinc-200"
                    />
                </div>
            </div>

            <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-sky-600" />
                        <span>Completed Task</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-sky-400" />
                        <span>On Going Task</span>
                    </div>
                    <div className="flex items-center gap-1.5 hidden sm:flex">
                        <div className="h-2 w-2 rounded-full bg-zinc-300" />
                        <span>Waiting Task</span>
                    </div>
                    <div className="flex items-center gap-1.5 hidden sm:flex">
                        <div className="h-2 w-2 rounded-full bg-zinc-200" />
                        <span>Others</span>
                    </div>
                </div>
                <div className="font-extrabold text-zinc-900 text-sm">60%</div>
            </div>
        </article>
    );
}
