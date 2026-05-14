"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "./firebase";
import { fetchAppUser } from "./auth";
import { AppUser, UserRole } from "@/types";

interface AuthCtx {
  user: User | null;
  appUser: AppUser | null;
  role: UserRole | null;
  loading: boolean;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  appUser: null,
  role: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const au = await fetchAppUser(u.uid);
        setAppUser(au);
        // Custom Claims에서 역할 읽기
        const token = await u.getIdTokenResult(true);
        setRole((token.claims.role as UserRole) || au?.role || null);
      } else {
        setAppUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ user, appUser, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
