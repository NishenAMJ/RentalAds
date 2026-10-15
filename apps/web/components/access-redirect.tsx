"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AccessRedirect({ href, message }: { href: string; message: string }) {
  const router = useRouter();
  useEffect(() => { router.replace(href); }, [href, router]);
  return <section className="panel">
    <p role="status">{message} Redirecting...</p>
    <Link className="button" href={href}>Continue</Link>
  </section>;
}
