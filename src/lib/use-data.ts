"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/*
 * Tiny client-side data loader (the pages used to read Supabase on the server).
 * `refreshData()` plays the role of router.refresh(): every mounted useData() loads again.
 */

let version = 0;
const listeners = new Set<() => void>();

export function refreshData() {
  version++;
  listeners.forEach((l) => l());
}

function useVersion() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
    () => 0,
  );
}

export type DataState<T> = { data: T | undefined; error: Error | null; loading: boolean; reload: () => void };

/**
 * Loads `fetcher()` after mount and whenever `key` changes or refreshData() is called.
 * `key` null = do not load yet. Previous data stays visible while reloading the same key.
 */
export function useData<T>(key: string | null, fetcher: () => Promise<T>): DataState<T> {
  const v = useVersion();
  const [local, setLocal] = useState(0);
  const [state, setState] = useState<{ key: string | null; data: T | undefined; error: Error | null; done: string | null }>({
    key: null,
    data: undefined,
    error: null,
    done: null,
  });

  const run = `${key}#${v}#${local}`;
  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    fetcher().then(
      (data) => !cancelled && setState({ key, data, error: null, done: run }),
      (e: unknown) => !cancelled && setState((s) => ({ key, data: s.key === key ? s.data : undefined, error: e instanceof Error ? e : new Error(String(e)), done: run })),
    );
    return () => {
      cancelled = true;
    };
    // the fetcher closes over the same inputs as `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  const reload = useCallback(() => setLocal((n) => n + 1), []);
  const sameKey = state.key === key;
  return { data: sameKey ? state.data : undefined, error: sameKey ? state.error : null, loading: state.done !== run, reload };
}
