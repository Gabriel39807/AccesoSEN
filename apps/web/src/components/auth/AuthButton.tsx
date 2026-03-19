import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./auth.module.css";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  loadingLabel?: string;
};

export default function AuthButton({
  children,
  variant = "primary",
  loading = false,
  loadingLabel = "Cargando...",
  className = "",
  disabled,
  ...props
}: Props) {
  const baseClass = variant === "primary" ? styles.btnPrimary : variant === "secondary" ? styles.btnSecondary : styles.btnGhost;
  const locked = disabled || loading;
  return (
    <button
      {...props}
      disabled={locked}
      className={`${baseClass} ${locked ? styles.btnDisabled : ""} ${className}`}
    >
      {loading ? loadingLabel : children}
    </button>
  );
}
