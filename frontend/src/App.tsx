import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { useAuth } from "./auth";
import Layout from "./components/Layout";
import LoginPage from "./components/LoginPage";
import VerifierPage from "./components/VerifierPage";
import SettingsPage from "./components/SettingsPage";
import { AlertTriangle, LogOut, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, userRole, userEmail, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-lg shadow-primary-600/20">
            <ShieldCheck size={22} />
          </div>
          <div className="h-6 w-6 rounded-full border-2 border-primary-600 border-t-transparent animate-spin-slow" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (userRole === "none") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <div className="w-full max-w-md animate-fade-in-up rounded-2xl border border-amber-200/60 bg-amber-50/80 p-6 shadow-lg shadow-amber-100/30 backdrop-blur-sm dark:border-amber-800/60 dark:bg-amber-950/50 dark:shadow-black/10">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/50">
              <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="font-semibold text-amber-800 dark:text-amber-200">
                Access Denied
              </h2>
              <p className="mt-1.5 text-sm text-amber-700 dark:text-amber-300">
                <strong>{userEmail}</strong> is not a member of a required Okta group.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-amber-600 dark:text-amber-400">
                Ask your Okta admin to add you to the{" "}
                <code className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs dark:bg-amber-900/60">
                  push-verifier-admin
                </code>{" "}
                or{" "}
                <code className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs dark:bg-amber-900/60">
                  push-verifier-user
                </code>{" "}
                group, and ensure a{" "}
                <code className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs dark:bg-amber-900/60">
                  groups
                </code>{" "}
                claim is configured on the authorization server.
              </p>
              <button
                onClick={logout}
                className="mt-4 flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-amber-700 hover:shadow-md active:scale-[0.98]"
              >
                <LogOut size={15} />
                Sign out and try another account
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { userRole, isLoading } = useAuth();

  if (isLoading) return null;
  if (userRole !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login/callback" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<VerifierPage />} />
          <Route
            path="settings"
            element={
              <RequireAdmin>
                <SettingsPage />
              </RequireAdmin>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
