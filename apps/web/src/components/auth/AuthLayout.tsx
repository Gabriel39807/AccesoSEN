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
  const trustPoints =
    role === "admin"
      ? ["Sesión auditada", "Acceso por rol", "Monitoreo por sede"]
      : ["QR dinámico", "Historial personal", "Validación segura"];

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
    <main className={`${styles.layout} ${classByRole} px-4 py-5 md:px-6 md:py-6`}>
      <div
        ref={wrapperRef}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="mx-auto grid w-full max-w-7xl items-start gap-5 xl:grid-cols-[1.08fr_0.92fr]"
      >
        <motion.section
          className="order-2 xl:order-1"
          initial={{ opacity: 0, x: -60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <HeroVisual role={role} tx={tilt.tx} ty={tilt.ty} />
        </motion.section>

        <motion.section
          className="order-1 xl:order-2 xl:pt-1"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
        >
            <div className="w-full max-w-[32rem] xl:ml-auto">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
               className="mb-2.5 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--auth-accent)] shadow-sm backdrop-blur-md"
            >
              {badge}
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
               className={`max-w-xl text-3xl font-extrabold leading-[1.02] tracking-tight md:text-[2.75rem] ${styles.textStrong}`}
            >
              {title}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
               className={`mt-2.5 max-w-xl text-sm leading-snug md:text-[0.96rem] ${styles.textSoft}`}
            >
              {subtitle}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.58 }}
               className="mt-4 flex flex-wrap gap-2"
            >
              {trustPoints.map((point) => (
                <span key={point} className={styles.metaChip}>
                  {point}
                </span>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
               className="mt-4"
            >
              {children}
            </motion.div>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
