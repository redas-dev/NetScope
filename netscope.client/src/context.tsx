import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { request, write } from "./api";
import type { Session, User } from "./api";
import { Icon } from "./components/Icon";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [toast, setToast] = useState("");
  const notify = useCallback((text: string) => setToast(text), []);
  const clear = useCallback(() => {
    setSession(null);
  }, []);
  const signIn = useCallback((value: Session) => {
    setSession(value);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    request<User>("/api/auth/me", { signal: controller.signal })
      .then((user) => {
        if (!controller.signal.aborted) signIn({ user, expiresAt: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          clear();
          if (error.status !== 401) notify(error.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false);
      });
    return () => controller.abort();
  }, [signIn, clear, notify]);
  useEffect(() => {
    const expired = () => {
      clear();
      notify("Sesija baigėsi. Prisijunkite iš naujo.");
    };
    window.addEventListener("netscope:expired", expired);
    return () => {
      window.removeEventListener("netscope:expired", expired);
    };
  }, [clear, notify]);
  useEffect(() => {
    if (toast) {
      const timer = window.setTimeout(() => setToast(""), 6000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  async function signOut() {
    await write("/api/auth/logout", "POST");
    clear();
    notify("Sėkmingai atsijungėte.");
  }
  return (
    <AuthContext.Provider
      value={{ session, checking, signIn, signOut, notify }}
    >
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {toast && (
          <div className="toast">
            <Icon name="info" />
            <span>{toast}</span>
            <button
              className="icon-button"
              aria-label="Uždaryti pranešimą"
              onClick={() => setToast("")}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
      </div>
    </AuthContext.Provider>
  );
}
