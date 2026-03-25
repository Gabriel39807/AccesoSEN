import { ArrowRight, GraduationCap, ShieldCheck } from "lucide-react";
import styles from "./auth.module.css";

export type AuthRole = "admin" | "aprendiz";

const roleOrder: AuthRole[] = ["admin", "aprendiz"];

type Props = {
  value: AuthRole;
  onChange: (role: AuthRole) => void;
};

export default function RoleSwitch({ value, onChange }: Props) {
  const index = roleOrder.indexOf(value);

  return (
    <div className={styles.roleSwitch} role="group" aria-label="Seleccionar rol">
      <span className={styles.rolePill} style={{ transform: `translateX(${index * 100}%)` }} aria-hidden />

      <button
        type="button"
        aria-pressed={value === "admin"}
        onClick={() => onChange("admin")}
        className={`${styles.roleBtn} ${value === "admin" ? styles.roleBtnActive : ""}`}
      >
        <span className={styles.roleIcon} aria-hidden>
          <ShieldCheck className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <span className={styles.roleText}>
          <span className={styles.roleLabel}>Administrador</span>
          <span className={styles.roleHint}>Gestion y control</span>
        </span>
        <ArrowRight className={styles.roleArrow} aria-hidden />
      </button>

      <button
        type="button"
        aria-pressed={value === "aprendiz"}
        onClick={() => onChange("aprendiz")}
        className={`${styles.roleBtn} ${value === "aprendiz" ? styles.roleBtnActive : ""}`}
      >
        <span className={styles.roleIcon} aria-hidden>
          <GraduationCap className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <span className={styles.roleText}>
          <span className={styles.roleLabel}>Estudiante</span>
          <span className={styles.roleHint}>Credencial y acceso</span>
        </span>
        <ArrowRight className={styles.roleArrow} aria-hidden />
      </button>
    </div>
  );
}

