"use client";

import { getAccessToken } from "./auth";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

export async function apiRequest<T>(path: string, options: RequestInit & { authenticated?: boolean } = {}): Promise<T> {
  const { authenticated, ...init } = options;
  const headers = new Headers(init.headers);
  if (init.body instanceof FormData) {
    // The browser adds the multipart boundary when sending files.
    headers.delete("Content-Type");
  } else if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (authenticated) {
    const token = await getAccessToken();
    if (!token) throw new ApiError("Please sign in to continue.", 401);
    headers.set("Authorization", `Bearer ${token}`);
  }
  let response: Response;
  try {
    response = await fetch(`${(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "")}${path}`, { ...init, headers, cache: "no-store" });
  } catch {
    throw new Error("We couldn't reach the rental service. Please try again shortly.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
    const message = response.status >= 500 ? "The rental service is temporarily unavailable. Please try again." : body?.message;
    throw new ApiError(Array.isArray(message) ? message.join(". ") : message ?? "The request could not be completed.", response.status);
  }
  return response.json() as Promise<T>;
}
