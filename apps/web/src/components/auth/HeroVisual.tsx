import type { CSSProperties } from "react";
import type { AuthRole } from "./RoleSwitch";
import SplineHeroRobot from "./SplineHeroRobot";
import styles from "./auth.module.css";

type Props = {
  role: AuthRole;
  tx: number;
  ty: number;
};

function shift(tx: number, ty: number, x: number, y: number, extra = ""): CSSProperties {
  return { transform: `translate3d(${tx * x}px, ${ty * y}px, 0) ${extra}`.trim() };
}

export default function HeroVisual({ role, tx, ty }: Props) {
  const admin = role === "admin";

  return (
    <div className={styles.hvRoot} aria-hidden>
      <div className={styles.hvBackgroundLayer} style={shift(tx, ty, -0.1, -0.1)} />
      <div className={styles.hvGlowA} style={shift(tx, ty, -0.26, -0.24)} />
      <div className={styles.hvGlowB} style={shift(tx, ty, 0.22, 0.2)} />

      <div className={styles.hvWordMain}>CONTROL</div>
      <div className={styles.hvWordAccent}>SEGURO..</div>

      <div className={styles.hvStatusCard} style={shift(tx, ty, 0.22, -0.05)}>
        <span className={styles.hvStatusIcon} aria-hidden>
          <svg viewBox="0 0 20 20">
            <path d="M5.2 10.1 8.2 13l6.6-6.6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className={styles.hvStatusText}>S.A.D.I</span>
      </div>

      <div className={styles.hvRoleMark} style={shift(tx, ty, 0.18, 0.14)} aria-hidden>
        {admin ? (
          <svg viewBox="0 0 120 120" className={styles.hvRoleMarkSvg}>
            <path d="M60 10 98 26v36c0 28-18 42-38 48-20-6-38-20-38-48V26L60 10Z" fill="rgba(16,185,129,0.14)" stroke="rgba(16,185,129,0.85)" strokeWidth="4" />
            <path d="m44 60 11 11 22-24" fill="none" stroke="rgba(16,185,129,0.95)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 168 120" className={styles.hvRoleMarkSvg}>
            <defs>
              <linearGradient id="cardGlow" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="rgba(56,189,248,0.68)" />
                <stop offset="100%" stopColor="rgba(16,185,129,0.52)" />
              </linearGradient>
            </defs>
            <rect x="8" y="10" width="152" height="102" rx="14" fill="rgba(125,211,252,0.26)" stroke="url(#cardGlow)" strokeWidth="4" />
            <rect x="22" y="28" width="44" height="54" rx="10" fill="rgba(226,232,240,0.72)" />
            <circle cx="44" cy="45" r="9" fill="rgba(16,185,129,0.72)" />
            <path d="M30 72c2.6-8.4 9.4-12.8 14-12.8s11.4 4.4 14 12.8" fill="none" stroke="rgba(16,185,129,0.72)" strokeWidth="4" strokeLinecap="round" />
            <g fill="rgba(15,118,110,0.78)">
              <rect x="84" y="68" width="6" height="6" rx="1.2" />
              <rect x="93" y="68" width="6" height="6" rx="1.2" />
              <rect x="102" y="68" width="6" height="6" rx="1.2" />
              <rect x="111" y="68" width="6" height="6" rx="1.2" />
              <rect x="120" y="68" width="6" height="6" rx="1.2" />
              <rect x="129" y="68" width="6" height="6" rx="1.2" />
              <rect x="84" y="77" width="6" height="6" rx="1.2" />
              <rect x="102" y="77" width="6" height="6" rx="1.2" />
              <rect x="120" y="77" width="6" height="6" rx="1.2" />
              <rect x="129" y="77" width="6" height="6" rx="1.2" />
              <rect x="84" y="86" width="6" height="6" rx="1.2" />
              <rect x="93" y="86" width="6" height="6" rx="1.2" />
              <rect x="111" y="86" width="6" height="6" rx="1.2" />
              <rect x="129" y="86" width="6" height="6" rx="1.2" />
            </g>
          </svg>
        )}
      </div>

      <div className={styles.hvStage} style={shift(tx, ty, 0.1, 0.08)}>
        <div className={styles.hvStageRing} />
      </div>

      <div className={styles.hero3Wrap}>
        <div className={styles.hero3LayerMid}>
          <SplineHeroRobot role={role} tx={tx} ty={ty} />
        </div>
      </div>
    </div>
  );
}
