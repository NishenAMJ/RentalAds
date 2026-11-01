import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Explore homes",
  description: "Browse reviewed homes for rent across Sri Lanka. Filter by area, rent, bedrooms and more. Owner contact details stay private.",
  alternates: { canonical: "/listings" },
};

export default function ListingsLayout({ children }: { children: ReactNode }) {
  return children;
}
