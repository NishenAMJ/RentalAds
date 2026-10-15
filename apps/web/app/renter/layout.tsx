import type { ReactNode } from "react";
import { RequireSession } from "@/components/require-session";

export default function RenterLayout({ children }: { children: ReactNode }) {
  return <RequireSession>{children}</RequireSession>;
}
