import { redirect } from "next/navigation";

type ResetPageProps = {
  searchParams: Promise<{ email?: string; otp?: string }>;
};

export default async function ResetPage({ searchParams }: ResetPageProps) {
  const params = await searchParams;
  const q = new URLSearchParams();
  q.set("step", "reset");
  if (params.email) q.set("email", params.email);
  if (params.otp) q.set("otp", params.otp);
  redirect(`/password-recovery?${q.toString()}`);
}
