"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { AuthRole } from "./RoleSwitch";
import styles from "./auth.module.css";

type Props = {
  role: AuthRole;
  tx: number;
  ty: number;
  gestureTick?: number;
};

const ThreeRobotPlaceholder = dynamic(() => import("./ThreeRobotPlaceholder"), {
  ssr: false,
});

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export default function SplineHeroRobot({ role, tx, ty, gestureTick = 0 }: Props) {
  const tilt = useMemo(
    () => ({
      x: clamp(tx * 0.36, -10, 10),
      y: clamp(ty * 0.3, -9, 9),
    }),
    [tx, ty],
  );

  return (
    <div className={styles.splineHeroRoot}>
      <div className={styles.splineGroundShadow} />

      <div className={styles.splineStage} style={{ transform: `translate3d(${tilt.x}px, ${tilt.y}px, 0)` }}>
        <div className={`${styles.splineViewport} ${styles.splineViewportReady}`}>
          <ThreeRobotPlaceholder role={role} tx={tx} ty={ty} gestureTick={gestureTick} />
        </div>
        <div className={styles.splineSoftFallback} aria-hidden />
      </div>
    </div>
  );
}
