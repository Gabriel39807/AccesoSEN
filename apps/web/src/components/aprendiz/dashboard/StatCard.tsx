import SharedStatCard from "@/components/dashboard/shared/StatCard";

export default function StatCard({
  label,
  value,
  icon,
  tone = "default",
  loading,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: "default" | "ok" | "warn" | "danger";
  loading?: boolean;
}) {
  return <SharedStatCard label={label} value={value} icon={icon} tone={tone} loading={loading} />;
}

