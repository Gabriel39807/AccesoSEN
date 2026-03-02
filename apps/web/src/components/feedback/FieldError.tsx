"use client";

type FieldErrorProps = {
  text?: string;
  className?: string;
};

export default function FieldError({ text, className = "" }: FieldErrorProps) {
  return (
    <div className={`min-h-[1rem] text-xs text-rose-600 ${className}`.trim()} aria-live="polite">
      {text ?? ""}
    </div>
  );
}

