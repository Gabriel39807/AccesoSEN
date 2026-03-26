import { redirect } from "next/navigation";
import { PASSWORD_RECOVERY_ROUTE } from "@/lib/password-recovery-routes";

export const dynamic = "force-dynamic";

export default function ForgotPage() {
  redirect(PASSWORD_RECOVERY_ROUTE);
}
