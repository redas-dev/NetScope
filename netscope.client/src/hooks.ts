import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

// Keep links from the old hash-based UI working after switching to clean URLs.
const legacyRoute = window.location.hash.slice(1);
if (legacyRoute.startsWith("/")) {
  window.history.replaceState(null, "", legacyRoute);
}

export const navigate = (path: string) => {
  if (window.location.pathname === path) return;
  window.history.pushState(null, "", path);
  window.dispatchEvent(new Event("app:navigate"));
};
const subscribe = (callback: () => void) => {
  window.addEventListener("popstate", callback);
  window.addEventListener("app:navigate", callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("app:navigate", callback);
  };
};
export const useRoute = () =>
  useSyncExternalStore(subscribe, () => window.location.pathname);

export function useLoad<T>(loader: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<{
    data?: T;
    error?: Error;
    loading: boolean;
  }>({ loading: true });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    // Keep updates asynchronous and ignore responses from abandoned pages.
    Promise.resolve()
      .then(() => {
        if (!controller.signal.aborted) setState({ loading: true });
        return loader(controller.signal);
      })
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, loading: false });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ error, loading: false });
      });
    return () => controller.abort();
  }, [loader, version]);
  return { ...state, reload };
}
