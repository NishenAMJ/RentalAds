import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: "primary" | "secondary" | "ghost"; busy?: boolean }
export function Button({ variant = "primary", busy, disabled, className = "", children, type = "button", ...props }: ButtonProps) {
  return <button {...props} type={type} disabled={disabled || busy} aria-busy={busy || undefined} className={`ui-button ui-button-${variant} ${className}`}>{busy && <span className="spinner" aria-hidden="true" />}{children}</button>;
}
export interface ActionLinkProps { href: string; children: ReactNode; variant?: "primary" | "secondary"; className?: string }
export function ActionLink({ href, children, variant = "primary", className = "" }: ActionLinkProps) { return <Link href={href} className={`ui-button ui-button-${variant} ${className}`}>{children}</Link>; }
export interface FieldProps { id: string; label: string; hint?: string; error?: string }
export function InputField({ id, label, hint, error, ...props }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return <div className="ui-field"><label htmlFor={id}>{label}</label><input {...props} id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} />{error ? <small id={`${id}-error`} className="field-error">{error}</small> : hint ? <small id={`${id}-hint`}>{hint}</small> : null}</div>;
}
export function SelectField({ id, label, hint, error, children, ...props }: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return <div className="ui-field"><label htmlFor={id}>{label}</label><select {...props} id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}>{children}</select>{error ? <small id={`${id}-error`} className="field-error">{error}</small> : hint ? <small id={`${id}-hint`}>{hint}</small> : null}</div>;
}
export interface BadgeProps { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" }
export function Badge({ children, tone = "neutral" }: BadgeProps) { return <span className={`ui-badge badge-${tone}`}><span aria-hidden="true">●</span>{children}</span>; }
export function PrivacyNote({ children = "Your request is private. Our team coordinates introductions with you directly." }: { children?: ReactNode }) { return <div className="privacy-note"><svg aria-hidden="true" className="privacy-icon" width="18" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><path d="M12 14v3" /></svg><p>{children}</p></div>; }
export function SkeletonCards({ label = "Loading properties" }: { label?: string }) { return <div role="status" aria-label={label} className="owner-grid"><span className="sr-only">{label}</span>{[0, 1, 2].map(n => <div className="skeleton-card" key={n} aria-hidden="true"><div className="skeleton skeleton-photo" /><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line short" /></div>)}</div>; }
export interface EmptyStateProps { title: string; description: string; action: ReactNode }
export function EmptyState({ title, description, action }: EmptyStateProps) { return <div className="empty-state"><span className="empty-symbol" aria-hidden="true">⌂</span><h2>{title}</h2><p>{description}</p>{action}</div>; }
