import { redirect } from "next/navigation";
import { buildPasswordRecoveryUrl } from "@/lib/password-recovery-routes";

export const dynamic = "force-dynamic";

export default function SuccessAliasPage() {
  redirect(buildPasswordRecoveryUrl("done"));
}
