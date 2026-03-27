"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";
import HeroVisual from "./HeroVisual";
import type { AuthRole } from "./RoleSwitch";
import styles from "./auth.module.css";

type Props = {
  role: AuthRole;
  children: ReactNode;
};

export default function AuthLayout({ role, children }: Props) {
  const classByRole = role === "admin" ? styles.layoutAdmin : styles.layoutAprendiz;
  const { resolvedTheme, setTheme } = useTheme();
  const activeTheme = resolvedTheme === "dark" ? "dark" : "light";

  return (
    <main className={`${styles.layout} ${classByRole}`}>
      <div className={`${styles.shell} grid min-h-[100dvh] xl:grid-cols-[0.94fr_1.06fr]`}>
        <motion.section
          initial={{ opacity: 0, x: -34 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className={styles.leftPane}
        >
          <HeroVisual role={role} />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: "easeOut", delay: 0.08 }}
          className={`${styles.rightPane} flex min-h-full flex-col`}
        >
          <div className="flex justify-end px-5 pt-5 md:px-7 md:pt-6 xl:px-8 xl:pt-7">
            <div className={styles.themeToggle} aria-label="Cambiar tema">
              <button
                type="button"
                className={`${styles.themeButton} ${activeTheme === "light" ? styles.themeButtonActive : ""}`}
                onClick={() => setTheme("light")}
                aria-pressed={activeTheme === "light"}
                aria-label="Activar modo claro"
              >
                <SunMedium className="h-4 w-4" strokeWidth={2.2} />
              </button>
              <button
                type="button"
                className={`${styles.themeButton} ${activeTheme === "dark" ? styles.themeButtonActive : ""}`}
                onClick={() => setTheme("dark")}
                aria-pressed={activeTheme === "dark"}
                aria-label="Activar modo oscuro"
              >
                <MoonStar className="h-4 w-4" strokeWidth={2.2} />
              </button>
            </div>
          </div>

          <div className={`${styles.rightContent} mx-auto flex flex-1 flex-col justify-center px-5 py-4 md:px-7 md:py-5 xl:px-8 xl:py-6`}>
            {children}
          </div>

          <div className="px-5 pb-5 text-center md:px-7 md:pb-6 xl:px-8 xl:pb-7 xl:text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-faint)]">
              Asegurado por SADI. · 2026
            </p>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
