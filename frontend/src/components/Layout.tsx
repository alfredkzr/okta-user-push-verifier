import { useState } from "react";
import { NavLink, Outlet } from "react-router";
import {
  ShieldCheck,
  Settings,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../auth";
import { useTheme } from "./ThemeContext";
import { cn } from "../lib/utils";

interface NavItemDef {
  to: string;
  icon: typeof ShieldCheck;
  label: string;
  end: boolean;
}

function NavItem({ item, onNavigate }: { item: NavItemDef; onNavigate: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
          isActive
            ? "bg-primary-50 text-primary-700 shadow-sm shadow-primary-100 dark:bg-primary-950/60 dark:text-primary-300 dark:shadow-none"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-300"
        )
      }
    >
      {({ isActive }: { isActive: boolean }) => (
        <>
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200",
              isActive
                ? "bg-primary-100 text-primary-600 dark:bg-primary-900/60 dark:text-primary-400"
                : "bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-500 dark:bg-slate-800 dark:text-slate-500 dark:group-hover:bg-slate-700 dark:group-hover:text-slate-400"
            )}
          >
            <item.icon size={16} />
          </div>
          {item.label}
        </>
      )}
    </NavLink>
  );
}

export default function Layout() {
  const { userEmail, userRole, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { to: "/", icon: ShieldCheck, label: "Verify", end: true },
    ...(userRole === "admin"
      ? [{ to: "/settings", icon: Settings, label: "Settings", end: false }]
      : []),
  ];

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="px-5 pb-2 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-md shadow-primary-600/25">
            <ShieldCheck size={18} strokeWidth={2.5} />
          </div>
          <div>
            <span className="text-[15px] font-semibold tracking-tight">
              Push Verifier
            </span>
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              Identity Platform
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="mt-6 flex-1 space-y-1 px-3">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Menu
        </p>
        {navItems.map((item) => (
          <NavItem key={item.to} item={item} onNavigate={() => setSidebarOpen(false)} />
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-slate-100 px-4 py-4 dark:border-slate-800/60">
        <div className="mb-3 rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-[11px] font-bold text-white">
              {(userEmail ?? "U").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{userEmail}</p>
              <span
                className={cn(
                  "inline-block mt-0.5 rounded-md px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide",
                  userRole === "admin"
                    ? "bg-primary-100 text-primary-700 dark:bg-primary-900/60 dark:text-primary-300"
                    : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                )}
              >
                {userRole}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleTheme}
            className="rounded-lg p-2 text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            title={theme === "dark" ? "Switch to light" : "Switch to dark"}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={logout}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-500 transition-all duration-200 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      {/* Desktop sidebar */}
      <aside className="hidden w-[260px] flex-shrink-0 border-r border-slate-200/70 bg-white dark:border-slate-800/60 dark:bg-slate-900 lg:block">
        {sidebar}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative z-50 h-full w-[260px] bg-white shadow-2xl shadow-slate-900/10 dark:bg-slate-900 animate-slide-in-right">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute right-3 top-5 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            >
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur-sm dark:border-slate-800/60 dark:bg-slate-900/80 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Menu size={20} />
          </button>
          <div className="ml-3 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-primary-500 to-primary-700 text-white">
              <ShieldCheck size={13} strokeWidth={2.5} />
            </div>
            <span className="text-sm font-semibold">Push Verifier</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="p-5 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
