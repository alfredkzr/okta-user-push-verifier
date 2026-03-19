import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { OktaAuth as OktaAuthType } from "@okta/okta-auth-js";

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  userEmail: string | null;
  userRole: "admin" | "user" | "none";
  oktaAuth: OktaAuthType;
  login: () => void;
  logout: () => void;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
  oktaAuth: OktaAuthType;
  initialAuth: boolean;
}

export function AuthProvider({ children, oktaAuth, initialAuth }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(initialAuth);
  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "user" | "none">("none");

  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    async function fetchProfile() {
      try {
        const accessToken = oktaAuth.getAccessToken();
        const idToken = oktaAuth.getIdToken();

        const headers: Record<string, string> = {};
        if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
        if (idToken) headers["X-ID-Token"] = idToken;

        const res = await fetch("/api/me", { headers });
        if (res.ok) {
          const data = await res.json();
          setUserEmail(data.email);
          setUserRole(data.role);
          if (data.role === "none") {
            console.warn("User authenticated but not authorized (no matching Okta group). Check backend logs.");
          }
        } else if (res.status === 401) {
          // Token invalid/expired — force re-login
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error("Profile fetch failed:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, [isAuthenticated, oktaAuth]);

  const login = useCallback(() => {
    oktaAuth.signInWithRedirect();
  }, [oktaAuth]);

  const logout = useCallback(async () => {
    try {
      await oktaAuth.revokeAccessToken();
    } catch { /* token may already be invalid */ }
    try {
      await oktaAuth.revokeRefreshToken();
    } catch { /* token may not exist */ }
    oktaAuth.tokenManager.clear();
    setIsAuthenticated(false);
    setUserEmail(null);
    setUserRole("none");
    window.location.replace("/login");
  }, [oktaAuth]);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {};
    const accessToken = oktaAuth.getAccessToken();
    const idToken = oktaAuth.getIdToken();
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    if (idToken) headers["X-ID-Token"] = idToken;
    return headers;
  }, [oktaAuth]);

  return (
    <AuthContext
      value={{
        isAuthenticated,
        isLoading,
        userEmail,
        userRole,
        oktaAuth,
        login,
        logout,
        getAuthHeaders,
      }}
    >
      {children}
    </AuthContext>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
