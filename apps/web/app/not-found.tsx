import { ActionLink } from "@/components/ui/primitives";
export default function NotFound() {
  return <section className="narrow panel fallback-page"><p className="eyebrow">Page not found</p><h1>Let’s find your next rental.</h1><p>This page may have moved, or the address may be incorrect.</p><ActionLink href="/categories">Browse rental categories</ActionLink></section>;
}
