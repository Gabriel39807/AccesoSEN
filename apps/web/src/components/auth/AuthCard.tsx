import type { ReactNode } from "react";
import styles from "./auth.module.css";

export default function AuthCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`${styles.card} ${className}`}>{children}</section>;
}
