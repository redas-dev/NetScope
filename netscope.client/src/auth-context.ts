import { createContext, useContext } from "react";
import type { Session } from "./api";

interface Auth {
  session: Session | null;
  checking: boolean;
  signIn: (session: Session) => void;
  signOut: () => Promise<void>;
  notify: (text: string) => void;
}
export const AuthContext = createContext<Auth | null>(null);
export const useAuth = () => useContext(AuthContext)!;
