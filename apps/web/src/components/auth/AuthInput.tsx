import type { InputHTMLAttributes } from "react";
import styles from "./auth.module.css";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string | null;
  hint?: string | null;
};

export default function AuthInput({ id, label, error, hint, className = "", ...props }: Props) {
  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={id} className="block text-sm font-semibold text-[color:var(--foreground)]">
          {label}
        </label>
      ) : null}
      <input
        id={id}
        suppressHydrationWarning
        className={`${styles.input} ${error ? styles.inputError : ""} ${className}`}
        {...props}
      />
      {hint ? <p className="text-xs text-[color:var(--text-muted)]">{hint}</p> : null}
      {error ? (
        <p aria-live="polite" className={`text-xs font-medium ${styles.statusError} ${styles.status}`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
