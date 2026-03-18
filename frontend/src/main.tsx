import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { OktaAuth } from "@okta/okta-auth-js";
import { AuthProvider } from "./auth";
import { ThemeProvider } from "./components/ThemeContext";
import App from "./App";
import "./index.css";

async function bootstrap() {
  const root = document.getElementById("root")!;
  const reactRoot = createRoot(root);

  reactRoot.render(
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-primary-600 border-t-transparent animate-spin-slow" />
    </div>
  );

  try {
    const configRes = await fetch("/api/auth/config");
    const config = await configRes.json();

    const oktaAuth = new OktaAuth({
      issuer: config.issuer,
      clientId: config.clientId,
      redirectUri: `${window.location.origin}/login/callback`,
      scopes: ["openid", "profile", "email", "groups"],
      pkce: true,
    });

    if (window.location.pathname === "/login/callback") {
      await oktaAuth.handleLoginRedirect();
      window.history.replaceState({}, "", "/");
    }

    const isAuthenticated = await oktaAuth.isAuthenticated();

    reactRoot.render(
      <StrictMode>
        <AuthProvider oktaAuth={oktaAuth} initialAuth={isAuthenticated}>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </AuthProvider>
      </StrictMode>
    );
  } catch (err) {
    reactRoot.render(
      <div className="flex h-screen items-center justify-center p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950">
          <p className="text-red-700 dark:text-red-300">
            Failed to initialize application. Check backend connectivity.
          </p>
        </div>
      </div>
    );
    console.error("Bootstrap failed:", err);
  }
}

bootstrap();
