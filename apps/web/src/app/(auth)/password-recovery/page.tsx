import { Suspense } from "react";
import PasswordRecoveryClient from "./password-recovery-client";

function LoadingFallback() {
  return <div className="p-6 text-sm text-slate-600">Cargando recuperacion de contrasena...</div>;
}

export default function PasswordRecoveryPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PasswordRecoveryClient />
    </Suspense>
  );
}
