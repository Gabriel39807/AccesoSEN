import { redirect } from "next/navigation";

type VerifyPageProps = {
  searchParams: Promise<{ email?: string }>;
};

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const params = await searchParams;
  const email = params.email ? `&email=${encodeURIComponent(params.email)}` : "";
  redirect(`/password-recovery?step=sent${email}`);
}
