"use client";
import Link from "next/link";
import { ActionLink, PrivacyNote } from "@/components/ui/primitives";
import { useT } from "@/components/i18n-provider";
import { Cursor, useTypewriter } from "@/components/typewriter";

const PILLARS = ["home.pillar1", "home.pillar2", "home.pillar3"] as const;
const STEPS = ["home.step1", "home.step2", "home.step3"] as const;

/** The marketing content of the home page, translated. */
export function HomeContent() {
  const t = useT();
  const [title1, title2, intro] = [t("home.title1"), t("home.title2"), t("home.intro")];
  const typing = useTypewriter([title1, title2, intro]);
  const typed = typing.lines;
  return <>
    <section className="concierge-hero">
      {/* Visitors without JavaScript get the finished text and buttons straight away. */}
      <noscript><style>{".tw-live{display:none}.tw-ghost{visibility:visible!important}.hero-reveal{opacity:1!important;visibility:visible!important}"}</style></noscript>
      <div className="hero-copy"><p className="eyebrow"><span className="live-dot" /> {t("home.eyebrow")}</p>
        {/* Screen readers and search engines read the full text immediately; only the animated copy is hidden from them. */}
        <h1 className="hero-title">
          <span className="sr-only">{title1} {title2}</span>
          <span className="tw-stage" aria-hidden="true">
            <span className="tw-ghost">{title1}<br /><em>{title2}</em></span>
            <span className="tw-live">{typed[0]}{typing.cursorLine === 0 && <Cursor />}<br /><em>{typed[1]}{typing.cursorLine === 1 && <Cursor />}</em></span>
          </span>
        </h1>
        <p className="intro">
          <span className="sr-only">{intro}</span>
          <span className="tw-stage" aria-hidden="true">
            <span className="tw-ghost">{intro}</span>
            <span className="tw-live">{typed[2]}{typing.cursorLine === 2 && <Cursor />}</span>
          </span>
        </p>
        <div className="hero-reveal" data-pending={!typing.done}>
          <div className="actions"><ActionLink href="/renter/new">{t("home.cta.find")} ↗</ActionLink><Link className="quiet-link" href="/listings">{t("home.cta.explore")} →</Link></div>
          <PrivacyNote>{t("home.privacy")}</PrivacyNote>
        </div>
      </div>
    </section>
    <section className="pillars" aria-label="Our approach">{PILLARS.map((key, index) =>
      <article className="pillar" key={key}><span className="pillar-number">PILLAR 0{index + 1}</span><h3>{t(`${key}.title`)}</h3><p>{t(`${key}.body`)}</p></article>)}</section>
    <section className="how-section" id="how-it-works"><div className="section-heading"><div><p className="eyebrow">{t("home.how.eyebrow")}</p><h2>{t("home.how.title")}</h2></div><p>{t("home.how.aside")}</p></div>
      <div className="process-grid">{STEPS.map((key, index) =>
        <article key={key}><span className="step-number">0{index + 1}</span><h3>{t(`${key}.title`)}</h3><p>{t(`${key}.body`)}</p></article>)}</div>
    </section>
    <section className="owner-invitation"><div><p className="eyebrow">{t("home.owner.eyebrow")}</p><h2>{t("home.owner.title")}</h2><p>{t("home.owner.body")}</p></div><ActionLink href="/owner/new" variant="secondary">{t("home.owner.cta")} ↗</ActionLink></section>
  </>;
}
