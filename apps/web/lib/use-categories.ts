"use client";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import type { CategoryDefinition } from "@/lib/items";

let cached: Promise<CategoryDefinition[]> | null = null;

/** The API's category definitions, fetched once per page load. `null` while loading. */
export function useCategoryDefinitions(): CategoryDefinition[] | null {
  const [definitions, setDefinitions] = useState<CategoryDefinition[] | null>(null);
  useEffect(() => {
    let active = true;
    cached ??= apiRequest<CategoryDefinition[]>("/categories");
    cached.then((result) => { if (active) setDefinitions(result); }).catch(() => {
      cached = null; // try again on the next visit
      if (active) setDefinitions([]);
    });
    return () => { active = false; };
  }, []);
  return definitions;
}
