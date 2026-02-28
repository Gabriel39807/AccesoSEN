"use client";

import { motion } from "framer-motion";
import SharedStatCard from "@/components/dashboard/shared/StatCard";
import { IconUser, IconClock, IconLaptop, IconHistory } from "@/components/aprendiz/dashboard/DashboardIcons";

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300 } }
};

export default function OverviewCards() {
    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
            <motion.div variants={item}>
                <SharedStatCard
                    label="Total Employees"
                    value={"245"}
                    icon={<IconUser className="h-5 w-5 text-sky-100" />}
                    tone="info"
                />
            </motion.div>
            <motion.div variants={item}>
                <SharedStatCard
                    label="New Hires"
                    value={"4"}
                    icon={<IconLaptop className="h-5 w-5 text-emerald-100" />}
                    tone="success"
                />
            </motion.div>
            <motion.div variants={item}>
                <SharedStatCard
                    label="Average Tenure"
                    value={"2.3yr"}
                    icon={<IconHistory className="h-5 w-5 text-amber-100" />}
                    tone="warning"
                />
            </motion.div>
            <motion.div variants={item}>
                <SharedStatCard
                    label="Probation"
                    value={"5"}
                    icon={<IconClock className="h-5 w-5 text-purple-100" />}
                    tone="purple"
                />
            </motion.div>
        </motion.div>
    );
}
