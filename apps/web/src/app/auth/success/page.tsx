import { redirect } from "next/navigation";

export default function SuccessAliasPage() {
  redirect("/password-recovery?step=done");
}
