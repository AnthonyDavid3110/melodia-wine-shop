import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

/**
 * Shared admin form-field wrappers (Phase 5 Gate 2A) — label + control
 * + inline validation errors, reused by every admin form (product,
 * campaign, and future bundle/seller forms) rather than each form
 * re-implementing this layout.
 */
export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p role="alert" className="text-danger text-body-sm font-sans">
      {messages[0]}
    </p>
  );
}

interface FieldProps {
  label: string;
  name: string;
  defaultValue?: string | null;
  errors?: string[];
  required?: boolean;
  hint?: string;
  type?: string;
  list?: string;
}

export function Field({
  label,
  name,
  defaultValue,
  errors,
  required,
  hint,
  type,
  list,
}: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>
        {label}
        {required ? null : <span className="text-muted-foreground"> (facultatif)</span>}
      </Label>
      <Input
        id={name}
        name={name}
        type={type ?? "text"}
        list={list}
        defaultValue={defaultValue ?? ""}
        required={required}
        aria-invalid={errors && errors.length > 0 ? true : undefined}
      />
      {hint ? <p className="text-muted-foreground text-body-sm font-sans">{hint}</p> : null}
      <FieldError messages={errors} />
    </div>
  );
}

interface TextFieldProps {
  label: string;
  name: string;
  defaultValue?: string | null;
  errors?: string[];
  hint?: string;
}

export function TextField({ label, name, defaultValue, errors, hint }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>
        {label} <span className="text-muted-foreground">(facultatif)</span>
      </Label>
      <Textarea
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
        rows={3}
        aria-invalid={errors && errors.length > 0 ? true : undefined}
      />
      {hint ? <p className="text-muted-foreground text-body-sm font-sans">{hint}</p> : null}
      <FieldError messages={errors} />
    </div>
  );
}
