"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;
export function getSupabase() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Sign-in is not configured. Please contact the site operator.");
  client = createClient(url, key, {
    auth: {
      // Keep authentication in memory only. A fresh page load must not
      // silently restore an old account from this browser's local storage.
      persistSession: false,
      autoRefreshToken: true,
    },
  });
  return client;
}
