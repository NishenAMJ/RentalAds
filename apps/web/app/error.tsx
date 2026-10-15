"use client";
import { ActionLink, Button } from "@/components/ui/primitives";
export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="narrow panel fallback-page"><p className="eyebrow">A little interruption</p><h1>We couldn’t load this page.</h1><p role="alert">Please try again. If the problem continues, you can return to browsing homes.</p><div className="actions"><Button onClick={reset}>Try again</Button><ActionLink href="/listings" variant="secondary">Back to homes</ActionLink></div></section>;
}
