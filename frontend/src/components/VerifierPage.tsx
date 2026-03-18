import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  User,
  X,
  Send,
  Loader2,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Fingerprint,
} from "lucide-react";
import { useAuth } from "../auth";
import { cn, relativeTime } from "../lib/utils";

interface VerifyStep {
  stage: string;
  message: string;
  status: "pending" | "active" | "done" | "error";
}

interface VerifyEvent {
  stage: string;
  message: string;
  result?: string;
  devices?: number;
}

interface LogEntry {
  timestamp: string;
  operator: string;
  target: string;
  status: string;
  devices_challenged: number;
}

const STEP_LABELS: Record<string, string> = {
  locating: "Locating user",
  protected_check: "Checking protected status",
  pushing: "Sending push",
  polling: "Awaiting response",
  success: "Verified",
  error: "Failed",
};

export default function VerifierPage() {
  const { getAuthHeaders } = useAuth();
  const [username, setUsername] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [steps, setSteps] = useState<VerifyStep[]>([]);
  const [finalResult, setFinalResult] = useState<VerifyEvent | null>(null);
  const [devices, setDevices] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/verification-log?limit=20", {
        headers: getAuthHeaders(),
      });
      if (res.ok) setLogs(await res.json());
    } catch {
      // silently fail
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleVerify = async () => {
    if (!username.trim() || isVerifying) return;

    setIsVerifying(true);
    setSteps([]);
    setFinalResult(null);
    setDevices(0);

    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });

      if (!res.ok || !res.body) {
        setFinalResult({ stage: "error", message: "Failed to start verification", result: "error" });
        setIsVerifying(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event: VerifyEvent = JSON.parse(line.slice(6));

            if (event.devices) setDevices(event.devices);

            if (event.result) {
              setFinalResult(event);
              setSteps((prev) =>
                prev.map((s) => (s.status === "active" ? { ...s, status: "done" } : s))
              );
            } else {
              setSteps((prev) => {
                const updated = prev.map((s) =>
                  s.status === "active" ? { ...s, status: "done" as const } : s
                );
                return [
                  ...updated,
                  { stage: event.stage, message: event.message, status: "active" },
                ];
              });
            }
          } catch {
            // skip malformed events
          }
        }
      }
    } catch {
      setFinalResult({ stage: "error", message: "Connection lost", result: "error" });
    } finally {
      setIsVerifying(false);
      fetchLogs();
    }
  };

  const resultConfig = finalResult?.result
    ? {
        approved: {
          icon: CheckCircle,
          bg: "bg-emerald-50 dark:bg-emerald-950/40",
          border: "border-emerald-200/60 dark:border-emerald-800/40",
          text: "text-emerald-700 dark:text-emerald-300",
          iconColor: "text-emerald-500 dark:text-emerald-400",
          label: "Identity Verified",
        },
        rejected: {
          icon: XCircle,
          bg: "bg-red-50 dark:bg-red-950/40",
          border: "border-red-200/60 dark:border-red-800/40",
          text: "text-red-700 dark:text-red-300",
          iconColor: "text-red-500 dark:text-red-400",
          label: "Verification Rejected",
        },
        timeout: {
          icon: Clock,
          bg: "bg-amber-50 dark:bg-amber-950/40",
          border: "border-amber-200/60 dark:border-amber-800/40",
          text: "text-amber-700 dark:text-amber-300",
          iconColor: "text-amber-500 dark:text-amber-400",
          label: "Verification Timed Out",
        },
        protected: {
          icon: ShieldCheck,
          bg: "bg-amber-50 dark:bg-amber-950/40",
          border: "border-amber-200/60 dark:border-amber-800/40",
          text: "text-amber-700 dark:text-amber-300",
          iconColor: "text-amber-500 dark:text-amber-400",
          label: "Protected User",
        },
        error: {
          icon: AlertTriangle,
          bg: "bg-red-50 dark:bg-red-950/40",
          border: "border-red-200/60 dark:border-red-800/40",
          text: "text-red-700 dark:text-red-300",
          iconColor: "text-red-500 dark:text-red-400",
          label: "Verification Failed",
        },
      }[finalResult.result]
    : null;

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      approved: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800/50",
      rejected: "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-800/50",
      timeout: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800/50",
    };
    return styles[status] || "bg-slate-50 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:ring-slate-700/50";
  };

  return (
    <div className="mx-auto max-w-6xl animate-fade-in">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Identity Verification
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Send an Okta Verify push challenge to confirm a user's identity
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: Verification */}
        <div className="space-y-5 lg:col-span-3">
          {/* Input card */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-slate-800/60 dark:bg-slate-900">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <User
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                  placeholder="Enter username or email"
                  disabled={isVerifying}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-3 pl-10 pr-10 text-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-primary-500 focus:bg-white focus:shadow-sm focus:shadow-primary-500/10 focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/80 dark:focus:bg-slate-800"
                />
                {username && !isVerifying && (
                  <button
                    onClick={() => setUsername("")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                onClick={handleVerify}
                disabled={!username.trim() || isVerifying}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-primary-600/20 transition-all duration-200 hover:shadow-md hover:shadow-primary-600/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                {isVerifying ? (
                  <Loader2 size={16} className="animate-spin-slow" />
                ) : (
                  <Send size={16} />
                )}
                {isVerifying ? "Verifying..." : "Verify"}
              </button>
            </div>
          </div>

          {/* Steps */}
          {steps.length > 0 && (
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-slate-800/60 dark:bg-slate-900 animate-scale-in">
              <div className="space-y-1">
                {steps.map((step, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3.5 rounded-xl px-3 py-2.5 transition-colors animate-fade-in"
                  >
                    <div className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center">
                      {step.status === "active" && (
                        <>
                          <div className="absolute h-7 w-7 rounded-full bg-primary-500/15 animate-pulse-ring" />
                          <div className="h-2.5 w-2.5 rounded-full bg-primary-600 shadow-sm shadow-primary-600/30" />
                        </>
                      )}
                      {step.status === "done" && (
                        <CheckCircle
                          size={18}
                          className="text-emerald-500 dark:text-emerald-400"
                        />
                      )}
                      {step.status === "error" && (
                        <XCircle
                          size={18}
                          className="text-red-500 dark:text-red-400"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          step.status === "active"
                            ? "text-slate-900 dark:text-white"
                            : "text-slate-600 dark:text-slate-300"
                        )}
                      >
                        {STEP_LABELS[step.stage] || step.stage}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {step.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {devices > 0 && isVerifying && (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                  <Fingerprint size={14} className="text-slate-400" />
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {devices} {devices === 1 ? "device" : "devices"} challenged
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Result card */}
          {finalResult && resultConfig && (
            <div
              className={cn(
                "rounded-2xl border p-5 animate-scale-in",
                resultConfig.bg,
                resultConfig.border
              )}
            >
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl",
                    resultConfig.bg
                  )}
                >
                  <resultConfig.icon size={24} className={resultConfig.iconColor} />
                </div>
                <div>
                  <p className={cn("font-semibold", resultConfig.text)}>
                    {resultConfig.label}
                  </p>
                  <p className={cn("mt-0.5 text-sm opacity-75", resultConfig.text)}>
                    {finalResult.message}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Recent activity */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-800/60 dark:bg-slate-900">
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4 dark:border-slate-800/60">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <Clock size={15} />
              </div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Recent Activity
              </h2>
            </div>

            {logs.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                  <Search size={20} className="text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
                  No recent verifications
                </p>
                <p className="mt-1 text-xs text-slate-400/70 dark:text-slate-600">
                  Verification attempts will appear here
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100/70 dark:divide-slate-800/60">
                {logs.map((entry, i) => (
                  <div
                    key={i}
                    className="px-5 py-3.5 transition-colors duration-150 hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                          {entry.target}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                          {relativeTime(entry.timestamp)}
                          {entry.devices_challenged > 0 &&
                            ` · ${entry.devices_challenged} ${entry.devices_challenged === 1 ? "device" : "devices"}`}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize",
                          statusBadge(entry.status)
                        )}
                      >
                        {entry.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      Verified by {entry.operator}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
