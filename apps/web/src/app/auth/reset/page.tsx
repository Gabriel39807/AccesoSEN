import { redirect } from "next/navigation";
import { buildPasswordRecoveryUrl } from "@/lib/password-recovery-routes";

type ResetPageProps = {
  searchParams: Promise<{ email?: string; otp?: string }>;
};

export default async function ResetPage({ searchParams }: ResetPageProps) {
  const params = await searchParams;
  redirect(buildPasswordRecoveryUrl("reset", { email: params.email, otp: params.otp }));
}
