"use client";

import { motion } from "framer-motion";

import SharedStatCard from "@/components/dashboard/shared/StatCard";
import { IconClock, IconHistory, IconLaptop, IconUser } from "@/components/aprendiz/dashboard/DashboardIcons";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300 } },
};

export default function OverviewCards() {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:gap-5"
    >
      <motion.div variants={item}>
        <SharedStatCard
          label="Usuarios monitoreados"
          value="245"
          icon={<IconUser className="h-5 w-5 text-sky-100" />}
          tone="info"
        />
      </motion.div>
      <motion.div variants={item}>
        <SharedStatCard
          label="Equipos en revisión"
          value="4"
          icon={<IconLaptop className="h-5 w-5 text-emerald-100" />}
          tone="success"
        />
      </motion.div>
      <motion.div variants={item}>
        <SharedStatCard
          label="Accesos auditados"
          value="128"
          icon={<IconHistory className="h-5 w-5 text-amber-100" />}
          tone="warning"
        />
      </motion.div>
      <motion.div variants={item}>
        <SharedStatCard
          label="Turnos activos"
          value="5"
          icon={<IconClock className="h-5 w-5 text-purple-100" />}
          tone="purple"
        />
      </motion.div>
    </motion.div>
  );
}
