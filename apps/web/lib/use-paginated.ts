"use client";
import { useCallback, useEffect, useState, type SetStateAction } from "react";
import { apiRequest } from "./api-client";

export type Page<T> = {
  data: T[];
  page: number;
  limit: number;
  hasNextPage: boolean;
};
/**
 * Loads one page of a collection. `query` is an optional, already-encoded query
 * string (for example filters) added to every request; callers should remount
 * the consumer (via `key`) when it changes so paging restarts at page 1.
 */
export function usePaginated<T>(
  path: string,
  authenticated = false,
  query = "",
) {
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    result: Page<T> | null;
    page: number;
    attempt: number;
    error: string;
  }>({ result: null, page: 0, attempt: -1, error: "" });
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      try {
        const result = await apiRequest<Page<T>>(
          `${path}?page=${page}&limit=20${query ? `&${query}` : ""}`,
          { authenticated, signal: controller.signal },
        );
        if (active) setState({ result, page, attempt, error: "" });
      } catch (cause) {
        if (active)
          setState({
            result: null,
            page,
            attempt,
            error:
              cause instanceof Error
                ? cause.message
                : "Unable to load results.",
          });
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [path, authenticated, query, page, attempt]);
  const setItems = useCallback((update: SetStateAction<T[]>) => {
    setState((current) =>
      current.result
        ? {
            ...current,
            result: {
              ...current.result,
              data:
                typeof update === "function"
                  ? update(current.result.data)
                  : update,
            },
          }
        : current,
    );
  }, []);
  const loading = state.page !== page || state.attempt !== attempt;
  return {
    items: loading ? [] : (state.result?.data ?? []),
    setItems,
    loading,
    error: loading ? "" : state.error,
    page,
    setPage,
    hasNextPage: !loading && !!state.result?.hasNextPage,
    retry: () => setAttempt((value) => value + 1),
  };
}
