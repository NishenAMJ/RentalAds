import type { ReactNode } from "react";
import Link from "next/link";
import { LEGAL_DRAFT, LEGAL_UPDATED } from "@/lib/legal";

export interface LegalPageProps { title: string; intro: string; children: ReactNode }

/** Shared layout for the privacy policy, terms and cookie notice. */
export function LegalPage({ title, intro, children }: LegalPageProps) {
  return (
    <article className="legal-page">
      <p className="eyebrow">Legal</p>
      <h1>{title}</h1>
      <p className="intro">{intro}</p>
      <p className="small-copy">Last updated {LEGAL_UPDATED}</p>
      {LEGAL_DRAFT && <p className="notice" role="note">This text is a draft and is being reviewed. It describes how the service works today.</p>}
      <div className="legal-body">{children}</div>
      <nav className="legal-links" aria-label="Legal documents">
        <Link href="/privacy">Privacy policy</Link>
        <Link href="/terms">Terms of service</Link>
        <Link href="/cookies">Cookie notice</Link>
      </nav>
    </article>
  );
}
