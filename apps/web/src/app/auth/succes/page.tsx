import { redirect } from "next/navigation";
import { PASSWORD_RECOVERY_SUCCESS_ROUTE } from "@/lib/password-recovery-routes";

export default function SuccessPage() {
  redirect(PASSWORD_RECOVERY_SUCCESS_ROUTE);
}
