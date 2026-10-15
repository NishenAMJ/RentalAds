"use client";

import { getSupabase } from "./supabase";

export async function getAccessToken(): Promise<string | null> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  return data.session?.access_token ?? null;
}
