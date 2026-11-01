"use client";
import { useT } from "@/components/i18n-provider";
import { labelFor, type CategoryDefinition, type FieldDefinition } from "@/lib/items";

/** The inputs for a category's own fields, named `attr.<key>` so the form can read them back with {@link readAttributes}. */
export function DynamicFields({ category, disabled, values }: { category: CategoryDefinition; disabled?: boolean; values?: Record<string, string | number | boolean> | null }) {
  const t = useT();
  return <>{category.fields.map((field) => {
    const id = `attr-${field.key}`;
    const label = labelFor(t, field.labelKey);
    if (field.type === "boolean")
      return <label key={field.key} className="checkbox option-row"><input id={id} name={`attr.${field.key}`} type="checkbox" disabled={disabled} defaultChecked={values?.[field.key] === true} />{label}</label>;
    return <label key={field.key} htmlFor={id}>{label}
      {field.type === "select"
        ? <select id={id} name={`attr.${field.key}`} required={field.required} disabled={disabled} defaultValue={typeof values?.[field.key] === "string" ? String(values[field.key]) : ""}>
            <option value="" disabled>—</option>
            {field.options?.map((option) => <option key={option.value} value={option.value}>{labelFor(t, option.labelKey)}</option>)}
          </select>
        : field.type === "number"
          ? <input id={id} name={`attr.${field.key}`} type="number" inputMode="numeric" min={field.min} max={field.max} step={1} required={field.required} disabled={disabled} defaultValue={typeof values?.[field.key] === "number" ? String(values[field.key]) : undefined} />
          : <input id={id} name={`attr.${field.key}`} type="text" maxLength={field.maxLength} required={field.required} disabled={disabled} defaultValue={typeof values?.[field.key] === "string" ? String(values[field.key]) : undefined} />}
    </label>;
  })}</>;
}

/** Collects the category fields from a submitted form into the attributes object the API validates. */
export function readAttributes(category: CategoryDefinition, form: FormData): Record<string, string | number | boolean> {
  const attributes: Record<string, string | number | boolean> = {};
  for (const field of category.fields) {
    const raw = form.get(`attr.${field.key}`);
    const value = valueOf(field, raw, form.has(`attr.${field.key}`));
    if (value !== undefined) attributes[field.key] = value;
  }
  return attributes;
}

function valueOf(field: FieldDefinition, raw: FormDataEntryValue | null, present: boolean): string | number | boolean | undefined {
  if (field.type === "boolean") return present;
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return undefined;
  return field.type === "number" ? Number(text) : text;
}
