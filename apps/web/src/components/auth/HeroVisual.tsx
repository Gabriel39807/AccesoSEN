"use client";

import Image from "next/image";
import { BarChart3, Building2, CheckCircle2, ShieldCheck } from "lucide-react";
import type { AuthRole } from "./RoleSwitch";
import styles from "./auth.module.css";

type Props = {
  role: AuthRole;
};

const benefitCopy: Record<AuthRole, Array<{ title: string; text: string }>> = {
  admin: [
    { title: "Trazabilidad de ingresos", text: "Registro operativo, auditoria continua y control institucional por sede." },
    { title: "Validacion por rol", text: "Permisos claros para administracion, supervision y consulta segura." },
    { title: "Monitoreo por sede", text: "Vista centralizada para usuarios, sedes activas y estado operativo." },
  ],
  aprendiz: [
    { title: "Trazabilidad de accesos", text: "Consulta tus registros y manten tu acceso personal siempre visible." },
    { title: "Validacion segura", text: "Tu identidad se verifica con credenciales controladas y acceso por rol." },
    { title: "Monitoreo institucional", text: "Consulta equipos, historial y credencial desde un solo punto." },
  ],
};

export default function HeroVisual({ role }: Props) {
  const benefits = benefitCopy[role];

  return (
    <section className={`${styles.heroWrap} flex flex-col justify-between gap-6 p-6 md:p-8 xl:p-9`}>
      <div className="space-y-6">
        <div className={styles.brandMark}>
          <Image
            src="/auth/sadi-logo-light.png"
            alt="SADI."
            width={176}
            height={74}
            priority
            className={styles.brandLogo}
          />
        </div>

        <div className={styles.heroBadge}>
          <span className={styles.heroBadgeDot} aria-hidden />
          Acceso seguro
        </div>

        <div className="space-y-3">
          <h1 className={styles.heroTitle}>
            Control institucional <span className={styles.heroTitleAccent}>seguro</span>
          </h1>
          <p className={styles.heroText}>
            Accede a la plataforma institucional de SADI. con trazabilidad clara, validacion por rol y monitoreo
            operativo en tiempo real.
          </p>
        </div>

        <div className={styles.heroBenefits}>
          {benefits.map((item) => (
            <div key={item.title} className={styles.heroBenefit}>
              <span className={styles.heroBenefitIcon} aria-hidden>
                <CheckCircle2 className="h-4 w-4" strokeWidth={2.4} />
              </span>
              <div>
                <p className={styles.heroBenefitTitle}>{item.title}</p>
                <p className={styles.heroBenefitText}>{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.heroVisualBlock}>
        <div className={styles.heroMock} aria-hidden>
          <div className={styles.heroMockSidebar}>
            <div className={styles.heroMockDot} />
            <LayoutIcon />
            <UsersIcon />
            <ReportIcon />
            <ShieldIcon />
          </div>

          <div className={styles.heroMockBody}>
            <div className={styles.heroMockTop}>
              <div>
                <p className={styles.heroMockLabel}>Panel de control</p>
                <p className={styles.heroMockTitle}>{role === "admin" ? "Vista institucional activa" : "Acceso del estudiante"}</p>
              </div>
              <span className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-white/80">
                99.9%
              </span>
            </div>

            <div className={styles.heroMockMetrics}>
              <div className={styles.heroMetric}>
                <p className={styles.heroMetricValue}>24</p>
                <p className={styles.heroMetricLabel}>Usuarios activos</p>
              </div>
              <div className={styles.heroMetric}>
                <p className={styles.heroMetricValue}>5</p>
                <p className={styles.heroMetricLabel}>Sedes operativas</p>
              </div>
              <div className={styles.heroMetric}>
                <p className={styles.heroMetricValue}>99.9%</p>
                <p className={styles.heroMetricLabel}>Estado del sistema</p>
              </div>
            </div>

            <div className={styles.heroChart}>
              <svg viewBox="0 0 320 140" fill="none" preserveAspectRatio="none">
                <path d="M0 102H320" stroke="rgba(173,220,255,0.12)" />
                <path d="M0 72C24 72 24 100 48 100C72 100 72 58 96 58C120 58 120 88 144 88C168 88 168 42 192 42C216 42 216 74 240 74C264 74 264 32 288 32C304 32 310 48 320 52" stroke="rgba(93, 252, 224, 0.92)" strokeWidth="4" strokeLinecap="round" />
                <path d="M0 78C24 78 24 108 48 108C72 108 72 68 96 68C120 68 120 96 144 96C168 96 168 52 192 52C216 52 216 80 240 80C264 80 264 42 288 42C304 42 310 54 320 60" stroke="rgba(34,211,238,0.34)" strokeWidth="16" strokeLinecap="round" />
              </svg>
              <span className={styles.heroShield}>
                <ShieldCheck className="h-6 w-6" strokeWidth={2.1} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LayoutIcon() {
  return <BarChart3 className="h-4 w-4 text-white/70" strokeWidth={2.2} />;
}

function UsersIcon() {
  return <Building2 className="h-4 w-4 text-white/60" strokeWidth={2.2} />;
}

function ReportIcon() {
  return <BarChart3 className="h-4 w-4 text-white/[0.55]" strokeWidth={2.2} />;
}

function ShieldIcon() {
  return <ShieldCheck className="h-4 w-4 text-white/[0.68]" strokeWidth={2.2} />;
}


