import { redirect } from "next/navigation";
import { buildPasswordRecoveryUrl } from "@/lib/password-recovery-routes";

export default function SuccessAliasPage() {
  redirect(buildPasswordRecoveryUrl("done"));
}
