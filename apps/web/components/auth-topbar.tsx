import type { ReactNode } from "react";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

/** Compact top bar used on the landing and sign-in pages; the landing page can include primary navigation. */
export function AuthTopbar({ children, navigation }: { children?: ReactNode; navigation?: ReactNode }) {
  return <div className={`auth-topbar${navigation ? " landing-auth-topbar" : ""}`}>
    <Link className="brand" href="/">RentalHub<span>Sri Lanka</span></Link>
    {navigation && <nav className="landing-nav" aria-label="Main navigation">{navigation}</nav>}
    <div className="auth-topbar-controls">{children}<LanguageSwitcher /><ThemeToggle /></div>
  </div>;
}
