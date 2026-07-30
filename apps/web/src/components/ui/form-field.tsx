import { useId } from 'react';

const CONTROL_CLASS =
  'bg-surface-muted w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-slate-500 focus:outline-none disabled:opacity-60';

type FieldProps = {
  label: string;
  name: string;
  hint?: string;
  required?: boolean;
};

export function TextField({
  label,
  name,
  hint,
  required,
  type = 'text',
  defaultValue,
  placeholder,
  autoComplete,
}: FieldProps & {
  type?: 'text' | 'email' | 'password' | 'url' | 'tel' | 'time';
  defaultValue?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  const id = useId();

  return (
    <Labelled id={id} label={label} hint={hint} required={required}>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={CONTROL_CLASS}
      />
    </Labelled>
  );
}

export function TextAreaField({
  label,
  name,
  hint,
  required,
  defaultValue,
  rows = 3,
}: FieldProps & { defaultValue?: string; rows?: number }) {
  const id = useId();

  return (
    <Labelled id={id} label={label} hint={hint} required={required}>
      <textarea
        id={id}
        name={name}
        rows={rows}
        required={required}
        defaultValue={defaultValue}
        className={CONTROL_CLASS}
      />
    </Labelled>
  );
}

export function SelectField({
  label,
  name,
  hint,
  required,
  defaultValue,
  options,
}: FieldProps & { defaultValue?: string; options: readonly string[] }) {
  const id = useId();

  return (
    <Labelled id={id} label={label} hint={hint} required={required}>
      <select
        id={id}
        name={name}
        required={required}
        defaultValue={defaultValue}
        className={CONTROL_CLASS}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </Labelled>
  );
}

function Labelled({
  id,
  label,
  hint,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-200">
        {label}
        {required === true && <span className="text-accent"> *</span>}
      </label>
      {children}
      {hint !== undefined && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export { CONTROL_CLASS };
