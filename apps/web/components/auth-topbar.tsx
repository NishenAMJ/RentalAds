import type { ReactNode } from "react";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * The slim bar used instead of the full site header on the landing and sign-in pages: a way home, an optional
 * link, the language and the theme. Nothing else competes with the page's own content.
 */
export function AuthTopbar({ children }: { children?: ReactNode }) {
  return <div className="auth-topbar">
    <Link className="brand" href="/">RentalHub<span>Sri Lanka</span></Link>
    <div className="auth-topbar-controls">{children}<LanguageSwitcher /><ThemeToggle /></div>
  </div>;
}
