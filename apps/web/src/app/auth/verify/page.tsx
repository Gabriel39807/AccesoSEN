import { redirect } from "next/navigation";
import { buildPasswordRecoveryUrl } from "@/lib/password-recovery-routes";

type VerifyPageProps = {
  searchParams: Promise<{ email?: string }>;
};

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const params = await searchParams;
  redirect(buildPasswordRecoveryUrl("sent", { email: params.email }));
}
