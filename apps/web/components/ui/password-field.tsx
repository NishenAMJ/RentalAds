"use client";

import { useState, type InputHTMLAttributes } from "react";

export interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id"> {
  id: string;
  label?: string;
}
export function PasswordField({ id, label = "Password", disabled, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return <div className="ui-field"><label htmlFor={id}>{label}</label>
    <div className="password-control"><input {...props} id={id} type={visible ? "text" : "password"} disabled={disabled} />
      <button type="button" className="password-toggle" aria-label={visible ? "Hide password" : "Show password"} aria-controls={id} aria-pressed={visible} disabled={disabled} onClick={() => setVisible(value => !value)}>{visible ? "Hide" : "Show"}</button>
    </div>
  </div>;
}
