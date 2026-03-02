This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## UI Feedback System

Esta app usa un sistema estandar para errores, estados y confirmaciones en UI.

### Componentes

- `src/components/feedback/FormBanner.tsx`
  - Mensajes globales o de modal (`error|success|warning|info`).
- `src/components/feedback/FieldError.tsx`
  - Error por campo debajo de inputs/selects.
- `src/components/feedback/InlineNotice.tsx`
  - Mensajes pequenos inline (ej. celdas/filas).
- `src/components/feedback/ConfirmModal.tsx`
  - Confirmaciones destructivas usando `Modal` de la app.

### Hook

- `src/hooks/useFormFeedback.ts`
  - Estado uniforme:
    - `banner`, `setBanner`, `clearBanner`
    - `fieldErrors`, `setFieldErrors`, `clearFieldError`, `clearAllFieldErrors`
    - `setFromApiError(err)` para parseo centralizado
    - `focusFirstError(refMap)` para enfocar el primer campo con error

### Helper de API errors

- `src/lib/apiError.ts`
  - Contrato unico:
    - `status?`, `code?`, `message`, `fieldErrors?`
  - Reglas:
    - 403 -> permisos
    - red/timeout -> conectividad
    - mapeo de errores por campo (`{ field: ["msg"] }`)
    - sin JSON crudo al usuario

### Patron recomendado (resumen)

```tsx
const feedback = useFormFeedback();

try {
  await api.post("/api/...", payload);
  feedback.setBanner({ type: "success", message: "Guardado correctamente." });
} catch (err) {
  feedback.setFromApiError(err, "No se pudo guardar.");
}
```

```tsx
{feedback.banner ? <FormBanner type={feedback.banner.type} message={feedback.banner.message} /> : null}
<input
  onChange={(e) => {
    setValue(e.target.value);
    feedback.clearFieldError("campo");
    feedback.clearBanner();
  }}
/>
<FieldError text={feedback.fieldErrors.campo} />
```

### Anti-regresion

- ESLint bloquea `alert()` y `confirm/prompt` del navegador.
- CI incluye guardrail para evitar reintroducir popups.
