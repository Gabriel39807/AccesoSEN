import Link from "next/link";

export default function SuccessPage() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-white to-emerald-50 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border bg-white shadow-sm p-6 md:p-8 text-center">
        <div className="mx-auto h-16 w-16 rounded-full bg-emerald-600 text-white flex items-center justify-center text-2xl font-bold">
          ✓
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">¡Éxito!</h1>
        <p className="mt-2 text-slate-600">
          Tu contraseña ha sido actualizada correctamente.
        </p>

        <Link
          href="/login"
          className="mt-6 inline-flex items-center justify-center w-full h-12 rounded-2xl bg-emerald-600 text-white font-semibold shadow-sm hover:bg-emerald-700 transition"
        >
          Ir a iniciar sesión
        </Link>
      </section>
    </main>
  );
}
