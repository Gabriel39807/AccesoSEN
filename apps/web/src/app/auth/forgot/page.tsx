import { redirect } from "next/navigation";

export default function ForgotPage() {
  redirect("/password-recovery");
}
