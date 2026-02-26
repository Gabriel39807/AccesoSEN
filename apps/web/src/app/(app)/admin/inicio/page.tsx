"use client";

import PageHeader from "@/components/admin/PageHeader";
import OverviewCards from "@/components/admin/dashboard/OverviewCards";
import BestEmployeeWidget from "@/components/admin/dashboard/BestEmployeeWidget";
import ProgressWidget from "@/components/admin/dashboard/ProgressWidget";
import ScheduleWidget from "@/components/admin/dashboard/ScheduleWidget";
import { useMe } from "@/hooks/useMe";

export default function AdminInicioPage() {
    const { me, loadingMe } = useMe();

    if (loadingMe) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <p className="text-zinc-500 font-medium animate-pulse">Cargando panel...</p>
            </div>
        );
    }

    const nombre = me?.first_name || me?.username || "Administrador";

    return (
        <div className="flex flex-col space-y-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">
                        Welcome, {nombre}
                    </h1>
                    <p className="text-sm font-medium text-zinc-500 mt-1">
                        Ready to manage your HR tasks today?
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-2 text-sm font-bold text-white shadow shadow-sky-500/30 transition hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/60 disabled:opacity-50">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Import Data
                    </button>
                    <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white/70 px-4 py-2 text-sm font-bold text-zinc-700 backdrop-blur-md">
                        <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Oct 01, 2025
                    </div>
                </div>
            </div>

            <OverviewCards />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 flex flex-col space-y-6">
                    {/* Shortcuts could go here or upper */}
                    <div className="flex flex-wrap items-center gap-3 font-bold text-zinc-800 bg-white/60 p-4 sm:p-5 rounded-3xl border border-white backdrop-blur-md shadow-[0_10px_30px_rgba(2,6,23,0.06)]">
                        <span className="mr-2 sm:mr-4 text-sm">Shortcut</span>
                        <button className="rounded-xl border border-zinc-200 bg-white px-3 sm:px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition">
                            <span className="mr-1 sm:mr-2">📝</span> Post Job
                        </button>
                        <button className="rounded-xl border border-zinc-200 bg-white px-3 sm:px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition">
                            <span className="mr-1 sm:mr-2">📅</span> Schedule
                        </button>
                        <button className="ml-auto rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-500 hover:bg-zinc-50 transition hidden sm:block">
                            +
                        </button>
                    </div>

                    <BestEmployeeWidget />
                    <ProgressWidget />

                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between rounded-xl p-4 bg-gradient-to-r from-slate-900 to-sky-900 text-white shadow-lg">
                        <div className="font-bold text-sm">Easier with Our Mobile Apps</div>
                        <div className="flex gap-2">
                            <div className="bg-white/10 px-3 py-1.5 rounded border border-white/20 text-[10px] font-semibold text-white">App Store</div>
                            <div className="bg-white/10 px-3 py-1.5 rounded border border-white/20 text-[10px] font-semibold text-white">Google Play</div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-1 flex flex-col space-y-6">
                    {/* Worked Hours Mock Graph Widget */}
                    <article className="flex flex-col rounded-3xl border border-white/60 bg-white/70 p-5 shadow-[0_10px_30px_rgba(2,6,23,0.06)] backdrop-blur-xl">
                        <h3 className="text-base font-extrabold text-zinc-900 mb-4">Worked Hours</h3>
                        <div className="relative h-24 mb-6">
                            <svg className="w-full h-full text-sky-400" viewBox="0 0 100 30" preserveAspectRatio="none">
                                <path d="M0 15 Q 25 5, 50 15 T 100 15" fill="none" stroke="currentColor" strokeWidth="2" />
                                <path d="M0 25 Q 25 15, 50 25 T 100 25" fill="none" stroke="currentColor" strokeWidth="2" className="text-sky-300 opacity-50" />
                                <rect x="70" y="5" width="5" height="20" fill="currentColor" className="text-sky-100" />
                            </svg>
                        </div>
                        <div className="flex flex-col gap-4">
                            <div>
                                <p className="text-[10px] font-semibold text-zinc-500">Current Pay Period</p>
                                <p className="text-xl font-extrabold text-zinc-900">134h 21m</p>
                                <p className="text-[10px] font-medium text-zinc-400">This pay period: <span className="text-sky-600 font-semibold">Apr 31 - May 15</span></p>
                            </div>
                            <div className="h-px w-full bg-zinc-200"></div>
                            <div>
                                <p className="text-[10px] font-semibold text-zinc-500">Previous Pay Period</p>
                                <p className="text-lg font-extrabold text-zinc-900">110h 12m</p>
                                <p className="text-[10px] font-medium text-zinc-400">Prev pay period: <span className="text-sky-600 font-semibold">Apr 16 - Apr 30</span></p>
                            </div>
                        </div>
                    </article>

                    <ScheduleWidget />
                </div>
            </div>
        </div>
    );
}
