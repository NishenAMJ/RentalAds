"use client";
import Link from "next/link";
import { ActionLink, PrivacyNote } from "@/components/ui/primitives";
import { useT } from "@/components/i18n-provider";

const PILLARS = ["home.pillar1", "home.pillar2", "home.pillar3"] as const;
const STEPS = ["home.step1", "home.step2", "home.step3"] as const;

/** The marketing content of the home page, translated. */
export function HomeContent() {
  const t = useT();
  return <>
    <section className="concierge-hero">
      <div className="hero-copy"><p className="eyebrow"><span className="live-dot" /> {t("home.eyebrow")}</p>
        <h1>{t("home.title1")}<br /><em>{t("home.title2")}</em></h1>
        <p className="intro">{t("home.intro")}</p>
        <div className="actions"><ActionLink href="/renter/new">{t("home.cta.find")} ↗</ActionLink><Link className="quiet-link" href="/listings">{t("home.cta.explore")} →</Link></div>
        <PrivacyNote>{t("home.privacy")}</PrivacyNote>
      </div>
      <div className="hero-art" role="img" aria-label="Illustration of a quiet tropical courtyard home"><div className="art-sun" /><div className="art-building"><div className="art-window" /><div className="art-door" /><div className="art-shutter" /></div><div className="art-path" /><div className="art-planter" /><div className="art-leaf leaf-one" /><div className="art-leaf leaf-two" /><div className="art-leaf leaf-three" /><div className="art-caption"><span>Colombo, Sri Lanka</span><span>A more considered way home.</span></div></div>
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
