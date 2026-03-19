export const PASSWORD_RECOVERY_ROUTE = "/password-recovery";
export const PASSWORD_RECOVERY_SUCCESS_ROUTE = "/auth/success";

export function buildPasswordRecoveryUrl(
  step?: "sent" | "reset" | "done",
  params?: { email?: string; otp?: string },
) {
  const searchParams = new URLSearchParams();
  if (step) searchParams.set("step", step);
  if (params?.email) searchParams.set("email", params.email);
  if (params?.otp) searchParams.set("otp", params.otp);
  const query = searchParams.toString();
  return query ? `${PASSWORD_RECOVERY_ROUTE}?${query}` : PASSWORD_RECOVERY_ROUTE;
}
