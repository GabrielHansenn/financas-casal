import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormFieldProps = ComponentProps<typeof Input> & {
  label: string;
  name: string;
  error?: string;
};

// Labeled input with an accessible inline error message
export function FormField({ label, name, error, id, ...props }: FormFieldProps) {
  const inputId = id ?? name;
  const errorId = `${inputId}-error`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormMessage({ type, children }: { type: "error" | "success"; children: string }) {
  return (
    <p
      role={type === "error" ? "alert" : "status"}
      className={
        type === "error"
          ? "rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          : "rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400"
      }
    >
      {children}
    </p>
  );
}
