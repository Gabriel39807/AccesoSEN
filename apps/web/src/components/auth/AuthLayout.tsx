"use client";

import type { ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import HeroVisual from "./HeroVisual";
import type { AuthRole } from "./RoleSwitch";
import styles from "./auth.module.css";

type Props = {
  role: AuthRole;
  title: string;
  subtitle: string;
  badge: string;
  children: ReactNode;
};

export default function AuthLayout({ role, title, subtitle, badge, children }: Props) {
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
        <motion.section
          className="order-2 lg:order-1"
          initial={{ opacity: 0, x: -60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <HeroVisual role={role} tx={tilt.tx} ty={tilt.ty} />
        </motion.section>
        <motion.section
          className="order-1 lg:order-2 flex items-center"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
        >
          <div className="w-full">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mb-2 inline-flex rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-600"
            >
              {badge}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className={`text-3xl font-extrabold leading-tight md:text-4xl ${styles.textStrong}`}
            >
              {title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className={`mt-2 text-sm leading-relaxed md:text-base ${styles.textSoft}`}
            >
              {subtitle}
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="mt-5"
            >
              {children}
            </motion.div>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
