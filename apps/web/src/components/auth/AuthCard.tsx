"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import styles from "./auth.module.css";

export default function AuthCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
      className={`${styles.card} ${className}`}
    >
      {children}
    </motion.section>
  );
}
