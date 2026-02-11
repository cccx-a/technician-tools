import type { Component } from "solid-js";
import { createSignal, createEffect, Show } from "solid-js";
import { Router, Route } from "@solidjs/router";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import VehicleHistory from "./pages/VehicleHistory";
import { api, getCookie, setCookie, removeCookie } from "./services/api";

const AuthGuard: Component<{ children: any }> = (props) => {
  const [isAuthenticated, setIsAuthenticated] = createSignal<boolean | null>(
    null,
  );
  const [isLoading, setIsLoading] = createSignal(true);

  createEffect(async () => {
    // Wait 3 seconds for cookies to be available from parent domain
    console.log("AuthGuard: Waiting for cookies...");
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log("AuthGuard: Done waiting, checking cookies now...");

    // First, check if we have a valid local JWT token
    const existingToken = getCookie("tsm");

    console.log("AuthGuard: tsm cookie:", existingToken ? `found (${existingToken.substring(0, 20)}...)` : "NULL");

    // Helper function to detect if token is a valid JWT
    const isValidJWT = (token: string): boolean => {
      // JWT must have exactly 3 parts separated by dots
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      // Try to decode the first part (header)
      try {
        const decoded = atob(parts[0]);
        const parsed = JSON.parse(decoded);
        // JWT header should have 'alg' and 'typ' fields
        return parsed.alg && parsed.typ;
      } catch {
        return false;
      }
    };

    // Helper function to detect Laravel encrypted cookie
    const isLaravelEncryptedCookie = (token: string): boolean => {
      try {
        // Try URL decode first
        const decoded = decodeURIComponent(token);
        // Try to parse as JSON
        const parsed = JSON.parse(atob(decoded));
        // Laravel encrypted cookie has 'iv', 'value', 'mac' fields
        return parsed.iv && parsed.value && parsed.mac;
      } catch {
        return false;
      }
    };

    // Check token type
    const isLocalJwt = existingToken && isValidJWT(existingToken);
    const isLiftngoToken = existingToken && /^\d+\|/.test(existingToken);
    const isEncryptedCookie = existingToken && isLaravelEncryptedCookie(existingToken);

    // Also log liftngo_session for debugging
    const liftngoSession = getCookie("liftngo_session");
    console.log("AuthGuard: liftngo_session cookie:", liftngoSession ? `found (${liftngoSession.substring(0, 20)}...)` : "NULL");

    if (isLocalJwt) {
      // Already have local JWT - authenticated
      console.log("AuthGuard: Found local JWT, authenticated");
      setIsAuthenticated(true);
      setIsLoading(false);
      return;
    }

    if (isLiftngoToken) {
      // Have Liftngo token, need to exchange for local JWT via backend
      console.log("AuthGuard: Found Liftngo token, exchanging for local JWT...");
      try {
        const ssoResult = await api.ssoLogin(existingToken);

        if (ssoResult) {
          // SSO successful - store local JWT and keep Liftngo token for logout
          setCookie("tsm", ssoResult.token);
          localStorage.setItem("user", JSON.stringify(ssoResult.user));
          // Save Liftngo token for logout API call later
          localStorage.setItem("liftngo_token", existingToken);
          console.log("AuthGuard: SSO login successful");
          setIsAuthenticated(true);
        } else {
          console.warn("AuthGuard: SSO login returned no result");
          setIsAuthenticated(false);
        }
      } catch (error: any) {
        console.warn("AuthGuard: SSO login failed:", error?.message || error);
        // Don't remove cookies from parent domain - they belong to Liftngo
        setIsAuthenticated(false);
      }
      setIsLoading(false);
      return;
    }

    if (isEncryptedCookie) {
      // Have Laravel encrypted session cookie - need liftngo_session too
      console.log("AuthGuard: Found Laravel encrypted cookie, exchanging via backend...");

      // Get liftngo_session cookie too (required by Liftngo API)
      const liftngoSession = getCookie("liftngo_session");

      if (!liftngoSession) {
        console.warn("AuthGuard: Missing liftngo_session cookie");
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      try {
        const ssoResult = await api.ssoCookieLogin(existingToken, liftngoSession);

        if (ssoResult) {
          // Cookie SSO successful - store local JWT
          setCookie("tsm", ssoResult.token);
          localStorage.setItem("user", JSON.stringify(ssoResult.user));
          // Save encrypted cookies for potential logout later
          localStorage.setItem("liftngo_tsm", existingToken);
          localStorage.setItem("liftngo_session", liftngoSession);
          console.log("AuthGuard: Cookie SSO login successful");
          setIsAuthenticated(true);
        } else {
          console.warn("AuthGuard: Cookie SSO login returned no result");
          setIsAuthenticated(false);
        }
      } catch (error: any) {
        console.warn("AuthGuard: Cookie SSO login failed:", error?.message || error);

        // If permission denied (403), stop redirect loop and show error
        if (error.message && error.message.includes("permission")) {
          console.error("AuthGuard: Permission denied, stopping redirect loop");
          setIsAuthenticated(false);
          setIsLoading(false);
          alert(`Login failed: ${error.message}`); // Simple alert for now, better UI later
          // Clear cookies to allow relogin with different account
          removeCookie("tsm");
          removeCookie("liftngo_session");
          window.location.replace("/login");
          return;
        }

        // Don't remove cookies from parent domain - they belong to Liftngo
        setIsAuthenticated(false);
      }
      setIsLoading(false);
      return;
    }

    // No readable token - try cookie-based authentication (for HttpOnly cookies)
    console.log("AuthGuard: No readable token, trying cookie-based auth...");

    try {
      const cookieAuthResult = await api.loginWithCookie();

      if (cookieAuthResult && cookieAuthResult.user) {
        localStorage.setItem("user", JSON.stringify(cookieAuthResult.user));
        console.log("AuthGuard: Cookie-based authentication successful");
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      } else {
        console.warn("AuthGuard: Cookie auth returned no user data");
      }
    } catch (error: any) {
      console.warn("AuthGuard: Cookie-based auth failed:", error?.message || error);
    }

    // All authentication methods failed
    console.log("AuthGuard: All authentication methods failed, redirecting to login");
    setIsAuthenticated(false);
    setIsLoading(false);
  });

  return (
    <Show
      when={!isLoading()}
      fallback={
        <div class="min-h-screen flex flex-col items-center justify-center bg-primary">
          <div class="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
          <div class="text-text-primary text-lg">กำลังตรวจสอบสิทธิ์...</div>
          <div class="text-text-tertiary text-sm mt-2">รอสักครู่</div>
        </div>
      }
    >
      <Show
        when={isAuthenticated()}
        fallback={(() => {
          // Redirect to login page when not authenticated
          window.location.replace("/login");
          return null;
        })()}
      >
        {props.children}
      </Show>
    </Show>
  );
};

const App: Component = () => {
  return (
    <Router>
      <Route path="/login" component={Login} />
      <Route
        path="/"
        component={() => (
          <AuthGuard>
            <Dashboard />
          </AuthGuard>
        )}
      />
      <Route
        path="/vehicle/:id/history"
        component={() => (
          <AuthGuard>
            <VehicleHistory />
          </AuthGuard>
        )}
      />
      <Route
        path="/history"
        component={() => (
          <AuthGuard>
            <VehicleHistory />
          </AuthGuard>
        )}
      />
      <Route
        path="/:service/history"
        component={() => (
          <AuthGuard>
            <VehicleHistory />
          </AuthGuard>
        )}
      />
      <Route
        path="*paramName"
        component={() => (
          <AuthGuard>
            <Dashboard />
          </AuthGuard>
        )}
      />
    </Router>
  );
};

export default App;
