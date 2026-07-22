/**
 * KVJ Analytics — Form system (Prompt 5 §11, Prompt 9 §10)
 * Layer: Shared. One consistent, dependency-free validation approach + reusable
 * fields. Inline validation on blur + submit; error summary; fully token-styled.
 * DatePicker/TimePicker/FileUpload use native inputs now (upgradeable later).
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode, type FormEvent } from 'react';
import '../ui/ui.css';

// ── Lightweight validation (no external dependency) ──────────────────────────
export type Validator<V> = (value: V, all: Record<string, unknown>) => string | null;
export const validators = {
  required: (msg = 'This field is required'): Validator<unknown> => (v) =>
    v === undefined || v === null || v === '' ? msg : null,
  email: (msg = 'Enter a valid email'): Validator<string> => (v) => (!v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : msg),
  minLength: (n: number, msg?: string): Validator<string> => (v) => (!v || v.length >= n ? null : msg ?? `Must be at least ${n} characters`),
  min: (n: number, msg?: string): Validator<number> => (v) => (v == null || v >= n ? null : msg ?? `Must be ≥ ${n}`),
};

interface FormCtx {
  values: Record<string, unknown>;
  errors: Record<string, string>;
  setValue: (name: string, value: unknown) => void;
  register: (name: string, rules?: Validator<never>[]) => void;
  validateField: (name: string) => void;
}
const FormContext = createContext<FormCtx | null>(null);
export const useForm = () => {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error('Form fields must be used within <Form>');
  return ctx;
};

export function Form({ initial = {}, onSubmit, children }: {
  initial?: Record<string, unknown>; onSubmit: (values: Record<string, unknown>) => void | Promise<void>; children: ReactNode;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rules] = useState<Map<string, Validator<never>[]>>(new Map());

  const setValue = useCallback((name: string, value: unknown) => setValues((v) => ({ ...v, [name]: value })), []);
  const register = useCallback((name: string, r?: Validator<never>[]) => { if (r) rules.set(name, r); }, [rules]);

  const validateField = useCallback((name: string) => {
    const fieldRules = rules.get(name) ?? [];
    let err: string | null = null;
    for (const rule of fieldRules) { err = (rule as Validator<unknown>)(values[name], values); if (err) break; }
    setErrors((e) => ({ ...e, [name]: err ?? '' }));
    return !err;
  }, [rules, values]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    for (const [name, fieldRules] of rules) {
      for (const rule of fieldRules) {
        const err = (rule as Validator<unknown>)(values[name], values);
        if (err) { next[name] = err; break; }
      }
    }
    setErrors(next);
    if (Object.keys(next).length === 0) await onSubmit(values);
  };

  const ctx = useMemo(() => ({ values, errors, setValue, register, validateField }), [values, errors, setValue, register, validateField]);
  const errorList = Object.entries(errors).filter(([, v]) => v);

  return (
    <FormContext.Provider value={ctx}>
      <form onSubmit={handleSubmit} noValidate>
        {errorList.length > 0 && (
          <div role="alert" style={{ background: 'var(--status-danger-bg)', color: 'var(--status-danger)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 16, fontSize: 13 }}>
            Please fix {errorList.length} field{errorList.length > 1 ? 's' : ''} before continuing.
          </div>
        )}
        {children}
      </form>
    </FormContext.Provider>
  );
}

function Field({ name, label, rules, children }: { name: string; label?: string; rules?: Validator<never>[]; children: (p: { value: never; onChange: (v: unknown) => void; onBlur: () => void; invalid: boolean }) => ReactNode }) {
  const { values, errors, setValue, register, validateField } = useForm();
  register(name, rules);
  const error = errors[name];
  return (
    <div className="kvj-field" style={{ marginBottom: 16 }}>
      {label && <label className="kvj-label" htmlFor={name}>{label}</label>}
      {children({ value: values[name] as never, onChange: (v) => setValue(name, v), onBlur: () => validateField(name), invalid: !!error })}
      {error && <span className="kvj-error">{error}</span>}
    </div>
  );
}

// ── Field components ─────────────────────────────────────────────────────────
export function TextField({ name, label, type = 'text', placeholder, rules }: { name: string; label?: string; type?: string; placeholder?: string; rules?: Validator<never>[] }) {
  return (
    <Field name={name} label={label} rules={rules}>
      {({ value, onChange, onBlur, invalid }) => (
        <input id={name} className="kvj-input" type={type} placeholder={placeholder} aria-invalid={invalid}
          value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
      )}
    </Field>
  );
}
export function TextAreaField({ name, label, placeholder, rules }: { name: string; label?: string; placeholder?: string; rules?: Validator<never>[] }) {
  return (
    <Field name={name} label={label} rules={rules}>
      {({ value, onChange, onBlur, invalid }) => (
        <textarea id={name} className="kvj-textarea" placeholder={placeholder} aria-invalid={invalid} style={{ minHeight: 88 }}
          value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
      )}
    </Field>
  );
}
export function SelectField({ name, label, options, rules }: { name: string; label?: string; options: { value: string; label: string }[]; rules?: Validator<never>[] }) {
  return (
    <Field name={name} label={label} rules={rules}>
      {({ value, onChange, onBlur }) => (
        <select id={name} className="kvj-select" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} onBlur={onBlur}>
          <option value="" disabled>Select…</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
    </Field>
  );
}
export function CheckboxField({ name, label }: { name: string; label: string }) {
  const { values, setValue } = useForm();
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16, cursor: 'pointer' }}>
      <input type="checkbox" checked={!!values[name]} onChange={(e) => setValue(name, e.target.checked)} />
      {label}
    </label>
  );
}
export function SwitchField({ name, label }: { name: string; label: string }) {
  const { values, setValue } = useForm();
  const on = !!values[name];
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16, cursor: 'pointer' }}>
      {label}
      <button type="button" role="switch" aria-checked={on} onClick={() => setValue(name, !on)}
        style={{ width: 40, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer', background: on ? 'var(--brand)' : 'var(--border-strong)', position: 'relative', transition: 'background .15s' }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
      </button>
    </label>
  );
}

export function DatePickerField({ name, label, rules }: { name: string; label?: string; rules?: Validator<never>[] }) {
  return (
    <Field name={name} label={label} rules={rules}>
      {({ value, onChange, onBlur, invalid }) => (
        <input id={name} className="kvj-input" type="date" aria-invalid={invalid}
          value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
      )}
    </Field>
  );
}

export function TimePickerField({ name, label, rules }: { name: string; label?: string; rules?: Validator<never>[] }) {
  return (
    <Field name={name} label={label} rules={rules}>
      {({ value, onChange, onBlur, invalid }) => (
        <input id={name} className="kvj-input" type="time" aria-invalid={invalid}
          value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
      )}
    </Field>
  );
}

export function FileUploadField({ name, label, rules, accept }: { name: string; label?: string; rules?: Validator<never>[]; accept?: string }) {
  return (
    <Field name={name} label={label} rules={rules}>
      {({ value, onChange, invalid }) => {
        const file = value as { name: string; size: number } | null;
        return (
          <div style={{ border: invalid ? '2px dashed var(--status-danger)' : '2px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: 16, textAlign: 'center', background: 'var(--bg-sunken)' }}>
            {file ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                <button type="button" className="kvj-btn kvj-btn--danger kvj-btn--sm" onClick={() => onChange(null)}>Remove</button>
              </div>
            ) : (
              <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 24 }}>⤒</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Click to upload or drag & drop</span>
                <input type="file" accept={accept} style={{ display: 'none' }} onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onChange({ name: f.name, size: f.size });
                }} />
              </label>
            )}
          </div>
        );
      }}
    </Field>
  );
}

