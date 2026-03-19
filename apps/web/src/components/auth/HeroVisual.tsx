"use client";

import { motion } from "framer-motion";
import type { AuthRole } from "./RoleSwitch";
import RobotHeroArt from "./RobotHeroArt";
import styles from "./auth.module.css";

type Props = {
  role: AuthRole;
  tx: number;
  ty: number;
};

const pointsByRole: Record<AuthRole, string[]> = {
  admin: ["Trazabilidad por sede", "Revisión operativa", "Sesión reforzada"],
  aprendiz: ["QR dinámico", "Equipos registrados", "Historial personal"],
};

export default function HeroVisual({ role, tx, ty }: Props) {
  const points = pointsByRole[role];

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={styles.heroPanel}
      aria-hidden
    >
      <div className={styles.heroBackdrop} />
      <div className={styles.heroGrid} />

      <motion.div
        className={styles.heroBadge}
        animate={{ x: tx * 0.35, y: ty * 0.2 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
      >
        <span className={styles.heroBadgeIcon}>{role === "admin" ? "A" : "Q"}</span>
        {role === "admin" ? "Control institucional" : "Acceso del aprendiz"}
      </motion.div>

      <div className={styles.heroCanvas}>
        <div className={styles.heroCopy}>
          <p className={styles.heroEyebrow}>S.A.D.I.</p>
          <h3 className={styles.heroTitle}>
            {role === "admin" ? "Operación segura para administradores." : "Ingreso simple, claro y verificable."}
          </h3>
          <p className={styles.heroText}>
            {role === "admin"
              ? "Prioriza revisión, permisos y auditoría sin esconder acciones críticas detrás de ruido visual."
              : "Consulta tu acceso, valida tu identidad y resuelve tareas frecuentes sin fricción innecesaria."}
          </p>
        </div>

        <motion.div
          className={styles.heroCardPrimary}
          animate={{ x: tx * -0.2, y: ty * 0.15 }}
          transition={{ type: "spring", stiffness: 100, damping: 18 }}
        >
          <span className={styles.heroCardLabel}>Estado</span>
          <strong className={styles.heroCardValue}>{role === "admin" ? "Panel listo" : "Credencial activa"}</strong>
          <p className={styles.heroCardText}>
            {role === "admin" ? "Usuarios, sedes y accesos bajo un mismo flujo." : "Acceso personal con pasos visibles y feedback claro."}
          </p>
        </motion.div>

        <motion.div
          className={styles.heroCardSecondary}
          animate={{ x: tx * 0.25, y: ty * -0.15 }}
          transition={{ type: "spring", stiffness: 100, damping: 18 }}
        >
          <span className={styles.heroCardLabel}>Controles</span>
          <ul className={styles.heroList}>
            {points.map((point) => (
              <li key={point} className={styles.heroListItem}>
                <span className={styles.heroListDot} />
                {point}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
           className={styles.heroRobotContainer}
           animate={{ x: tx * 0.45, y: ty * 0.35 }}
           transition={{ type: "spring", stiffness: 90, damping: 20 }}
        >
          <RobotHeroArt role={role} tx={tx} ty={ty} />
        </motion.div>
      </div>
    </motion.section>
  );
}
