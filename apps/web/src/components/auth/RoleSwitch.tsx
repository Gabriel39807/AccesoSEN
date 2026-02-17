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
        Administrador
      </button>
      <button
        type="button"
        aria-pressed={value === "aprendiz"}
        onClick={() => onChange("aprendiz")}
        className={`${styles.roleBtn} ${value === "aprendiz" ? styles.roleBtnActive : ""}`}
      >
        Aprendiz
      </button>
    </div>
  );
}
