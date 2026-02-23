import SharedStatCard, { type StatTone } from "@/components/dashboard/shared/StatCard";

export default function StatCard({
  label,
  value,
  icon,
  tone = "neutral",
  loading,
  onClick,
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  tone?: "neutral" | "success" | "danger" | "info" | "warning" | "purple";
  loading?: boolean;
  onClick?: () => void;
}) {
  return (
    <SharedStatCard
      label={label}
      value={value}
      icon={icon}
      tone={tone as StatTone}
      loading={loading}
      onClick={onClick}
    />
  );
}

