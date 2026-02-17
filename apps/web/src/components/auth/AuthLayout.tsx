"use client";

import type { ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import HeroVisual from "./HeroVisual";
import type { AuthRole } from "./RoleSwitch";
import styles from "./auth.module.css";

type Props = {
  role: AuthRole;
  title: string;
  subtitle: string;
  badge: string;
  gestureTick?: number;
  children: ReactNode;
};

export default function AuthLayout({ role, title, subtitle, badge, gestureTick = 0, children }: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [move, setMove] = useState({ x: 0, y: 0 });

  const classByRole = role === "admin" ? styles.layoutAdmin : styles.layoutAprendiz;
  const tilt = useMemo(() => ({ tx: move.x * 14, ty: move.y * 14 }), [move.x, move.y]);

  function onMove(event: React.MouseEvent) {
    const el = wrapperRef.current;
    if (!el || typeof window === "undefined" || window.innerWidth < 1024) return;
    const rect = el.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    setMove({ x: (x - 0.5) * 2, y: (y - 0.5) * 2 });
  }

  function onLeave() {
    setMove({ x: 0, y: 0 });
  }

  return (
    <main className={`${styles.layout} ${classByRole} px-4 py-8 md:px-8 md:py-10`}>
      <div
        ref={wrapperRef}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.08fr_0.92fr]"
      >
        <section className="order-2 lg:order-1">
          <HeroVisual role={role} tx={tilt.tx} ty={tilt.ty} gestureTick={gestureTick} />
        </section>
        <section className="order-1 lg:order-2 flex items-center">
          <div className="w-full">
            <p className="mb-2 inline-flex rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-600">
              {badge}
            </p>
            <h1 className={`text-3xl font-extrabold leading-tight md:text-4xl ${styles.textStrong}`}>{title}</h1>
            <p className={`mt-2 text-sm leading-relaxed md:text-base ${styles.textSoft}`}>{subtitle}</p>
            <div className="mt-5">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
