import {
  ShieldCheck,
  Fingerprint,
  Users,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "../auth";
import { Navigate } from "react-router";

const features = [
  {
    icon: Fingerprint,
    title: "Push Verification",
    desc: "Send Okta Verify push challenges and get real-time results.",
  },
  {
    icon: Users,
    title: "Protected Users",
    desc: "Exclude sensitive accounts from verification attempts.",
  },
  {
    icon: ClipboardList,
    title: "Audit Logging",
    desc: "Full audit trail of every verification and admin action.",
  },
];

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();

  if (isAuthenticated) return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Left panel — branding & features */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 lg:flex lg:flex-col lg:justify-between">
        {/* Decorative shapes */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full bg-white/[0.06] blur-2xl" />
          <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-white/[0.04] blur-3xl" />
          <div className="absolute left-1/3 top-1/2 h-64 w-64 rounded-full bg-primary-400/10 blur-2xl" />
        </div>

        <div className="relative z-10 flex flex-1 flex-col justify-center px-12 xl:px-16">
          {/* Logo */}
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <ShieldCheck size={22} className="text-white" strokeWidth={2.2} />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              Push Verifier
            </span>
          </div>

          {/* Headline */}
          <h1 className="max-w-md text-3xl font-extrabold leading-tight tracking-tight text-white xl:text-4xl">
            Identity verification,{" "}
            <span className="text-primary-200">simplified.</span>
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-primary-100/80">
            Verify any user's identity with Okta Verify push notifications.
            Real-time status, audit logs, and admin controls — all in one place.
          </p>

          {/* Feature list */}
          <div className="mt-10 flex flex-col gap-5">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm">
                  <f.icon size={18} className="text-primary-200" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="mt-0.5 text-sm text-primary-200/70">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 px-12 pb-8 xl:px-16">
          <p className="text-xs text-primary-300/50">
            &copy; {new Date().getFullYear()} Push Verifier &middot; Open
            Source &middot; MIT License
          </p>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6">
        {/* Background decoration (visible on both mobile & desktop) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 h-[360px] w-[360px] rounded-full bg-primary-100/40 blur-3xl dark:bg-primary-900/15" />
          <div className="absolute -bottom-24 -left-24 h-[280px] w-[280px] rounded-full bg-primary-200/30 blur-3xl dark:bg-primary-800/10" />
        </div>


        <div className="relative z-10 w-full max-w-[400px] animate-fade-in-up">
          {/* Mobile-only logo (hidden on lg+) */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-lg shadow-primary-600/25">
              <ShieldCheck size={20} strokeWidth={2.2} />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Push Verifier
            </span>
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-8 shadow-xl shadow-slate-200/40 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/80 dark:shadow-black/20">
            <div className="mb-2">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Welcome back
              </h2>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                Sign in to access the verification dashboard.
              </p>
            </div>

            {/* SSO Button */}
            <button
              onClick={login}
              className="group mt-6 flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-primary-600/25 transition-all duration-200 hover:shadow-lg hover:shadow-primary-600/30 active:scale-[0.98]"
            >
              <ShieldCheck
                size={17}
                strokeWidth={2.2}
                className="opacity-80 transition-transform duration-200 group-hover:scale-110"
              />
              Continue with Okta
            </button>

            {/* Divider */}
            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700/60" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                SSO
              </span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700/60" />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
