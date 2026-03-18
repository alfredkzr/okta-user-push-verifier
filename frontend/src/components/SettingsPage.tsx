import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  CheckCircle,
  UserX,
  UserPlus,
  UserMinus,
} from "lucide-react";
import { useAuth } from "../auth";
import { cn } from "../lib/utils";

interface ProtectedUser {
  email: string;
  added_by?: string;
  added_at?: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  operator: string;
  target: string;
  details?: string;
}

export default function SettingsPage() {
  const { getAuthHeaders } = useAuth();
  const [protectedUsers, setProtectedUsers] = useState<ProtectedUser[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [auditExpanded, setAuditExpanded] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchProtectedUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/protected-users", { headers: getAuthHeaders() });
      if (res.ok) setProtectedUsers(await res.json());
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const fetchAuditLog = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/audit-log?limit=50", { headers: getAuthHeaders() });
      if (res.ok) setAuditLog(await res.json());
    } catch {
      // silently fail
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchProtectedUsers();
  }, [fetchProtectedUsers]);

  useEffect(() => {
    if (auditExpanded) fetchAuditLog();
  }, [auditExpanded, fetchAuditLog]);

  const handleAdd = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return;

    try {
      const res = await fetch("/api/settings/protected-users", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setNewEmail("");
        fetchProtectedUsers();
        showToast("success", `Added ${email} to protected list`);
      } else if (res.status === 409) {
        showToast("error", "User already in protected list");
      } else {
        showToast("error", "Failed to add user");
      }
    } catch {
      showToast("error", "Network error");
    }
  };

  const handleRemove = async (email: string) => {
    try {
      const res = await fetch(`/api/settings/protected-users/${encodeURIComponent(email)}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        fetchProtectedUsers();
        showToast("success", `Removed ${email} from protected list`);
      } else {
        showToast("error", "Failed to remove user");
      }
    } catch {
      showToast("error", "Network error");
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage protected users and view audit logs
        </p>
      </div>

      <div className="space-y-5">
        {/* Toast */}
        {toast && (
          <div
            className={cn(
              "fixed right-6 top-6 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-lg animate-toast-in",
              toast.type === "success"
                ? "bg-emerald-600 text-white shadow-emerald-600/20"
                : "bg-red-600 text-white shadow-red-600/20"
            )}
          >
            {toast.type === "success" ? (
              <CheckCircle size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
            {toast.message}
          </div>
        )}

        {/* Protected Users Card */}
        <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-800/60 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-800/60">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-400">
                <Shield size={20} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Protected Users
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Users excluded from push verification
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* Add form */}
            <div className="mb-5 flex gap-3">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="user@example.com"
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-primary-500 focus:bg-white focus:shadow-sm focus:shadow-primary-500/10 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800/80 dark:focus:bg-slate-800"
              />
              <button
                onClick={handleAdd}
                disabled={!newEmail.trim()}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-primary-600/20 transition-all duration-200 hover:shadow-md hover:shadow-primary-600/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                <Plus size={16} />
                Add
              </button>
            </div>

            {/* User list */}
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-6 w-6 rounded-full border-2 border-primary-600 border-t-transparent animate-spin-slow" />
              </div>
            ) : protectedUsers.length === 0 ? (
              <div className="py-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                  <UserX size={20} className="text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
                  No protected users configured
                </p>
                <p className="mt-1 text-xs text-slate-400/70 dark:text-slate-600">
                  Add emails above to exclude users from verification
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/80 dark:divide-slate-800/60 dark:border-slate-800/60">
                {protectedUsers.map((user) => (
                  <div
                    key={user.email}
                    className="flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                        {user.email}
                      </p>
                      {user.added_by && (
                        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                          Added by {user.added_by}
                        </p>
                      )}
                    </div>

                    {confirmDelete === user.email ? (
                      <div className="flex items-center gap-2 animate-fade-in">
                        <button
                          onClick={() => handleRemove(user.email)}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(user.email)}
                        className="rounded-lg p-2 text-slate-400 transition-all duration-200 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Audit Log */}
        <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-800/60 dark:bg-slate-900">
          <button
            onClick={() => setAuditExpanded(!auditExpanded)}
            className="flex w-full items-center justify-between px-6 py-4.5 text-left transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <FileText size={16} />
              </div>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Audit Log
              </span>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800">
              {auditExpanded ? (
                <ChevronUp size={15} />
              ) : (
                <ChevronDown size={15} />
              )}
            </div>
          </button>

          {auditExpanded && (
            <div className="border-t border-slate-100 dark:border-slate-800/60 animate-fade-in">
              {auditLog.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                    <FileText size={20} className="text-slate-400 dark:text-slate-500" />
                  </div>
                  <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
                    No audit entries yet
                  </p>
                  <p className="mt-1 text-xs text-slate-400/70 dark:text-slate-600">
                    Changes to protected users will be logged here
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100/70 dark:divide-slate-800/60">
                  {auditLog.map((entry, i) => {
                    const isAdd = entry.action.includes("ADD");
                    return (
                      <div key={i} className="flex gap-3.5 px-6 py-4">
                        <div
                          className={cn(
                            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                            isAdd
                              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
                              : "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400"
                          )}
                        >
                          {isAdd ? <UserPlus size={15} /> : <UserMinus size={15} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                              {isAdd ? "Added" : "Removed"}{" "}
                              <span className="font-semibold">{entry.target}</span>
                            </p>
                            <span className="flex-shrink-0 text-xs text-slate-400 dark:text-slate-500">
                              {new Date(entry.timestamp).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}{" "}
                              {new Date(entry.timestamp).toLocaleTimeString(undefined, {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                            By {entry.operator}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
