import { SkeletonCards } from "@/components/ui/primitives";

export default function Loading() {
  return <section aria-label="Loading page">
    <p className="eyebrow">Opening your next page</p>
    <SkeletonCards label="Loading page content" />
  </section>;
}
