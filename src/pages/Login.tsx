import { createSignal, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { api, setCookie, getCookie } from "../services/api";
import { t } from "../i18n/config";
import LanguageSelector from "../components/LanguageSelector";

const Login = () => {
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const navigate = useNavigate();

  // Check if already logged in via local JWT token on mount
  onMount(() => {
    // In development mode (localhost), skip auto-redirect to allow Dev Mode cookie input
    const isDevelopment = window.location.hostname === "localhost";
    if (isDevelopment) {
      console.log("Login page: Development mode detected, skipping auto-redirect for cookie input");
      return;
    }

    const existingToken = getCookie("tsm");
    console.log(
      "Login page: checking tsm cookie:",
      existingToken ? existingToken.substring(0, 20) + "..." : "null",
    );

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

    // Check token types
    const isLocalJwt = existingToken && isValidJWT(existingToken);
    const isLiftngoToken = existingToken && /^\d+\|/.test(existingToken);

    if (isLocalJwt) {
      // Already have local JWT - authenticated, redirect to dashboard
      console.log("Login page: Local JWT found, redirecting to dashboard");
      window.location.replace("/");
    } else if (isLiftngoToken) {
      // This is a Liftngo token - redirect to dashboard for SSO exchange
      console.log(
        "Login page: Liftngo token found, redirecting to dashboard for SSO exchange",
      );
      window.location.replace("/");
    } else {
      // No valid token - redirect to main Liftngo login page
      console.log("Login page: No token found, redirecting to Liftngo login");
      // window.location.replace(`${LIFTNGO_URL}/login`);
    }
  });

  const handleLogin = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await api.login(username(), password());
      // Store auth data in cookies instead of localStorage
      setCookie("tsm", response.token);
      localStorage.setItem("user", JSON.stringify(response.user));
      navigate("/");
    } catch (err) {
      setError(t("invalid_credentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen flex items-center justify-center bg-primary transition-colors duration-300 relative">
      <div class="absolute top-4 right-4">
        <LanguageSelector />
      </div>
      <div class="bg-secondary p-8 rounded-2xl shadow-xl w-full max-w-md border border-border-primary">
        <div class="text-center mb-8">
          <div class="w-12 h-12 bg-accent rounded-xl flex items-center justify-center text-accent-text font-bold text-xl mx-auto mb-4 shadow-lg shadow-accent/20">
            T
          </div>
          <h1 class="text-2xl font-bold text-text-primary">
            {t("technician_login")}
          </h1>
          <p class="text-text-tertiary mt-2">{t("enter_credentials")}</p>
        </div>

        <form onSubmit={handleLogin} class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-text-secondary mb-2">
              {t("username")}
            </label>
            <input
              type="text"
              value={username()}
              onInput={(e) => setUsername(e.currentTarget.value)}
              class="w-full px-4 py-3 rounded-lg border border-border-primary bg-tertiary text-text-primary focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
              placeholder={t("username")}
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-text-secondary mb-2">
              {t("password")}
            </label>
            <input
              type="password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              class="w-full px-4 py-3 rounded-lg border border-border-primary bg-tertiary text-text-primary focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          {error() && (
            <div class="p-3 bg-red-500/10 text-red-500 text-sm rounded-lg text-center border border-red-500/20">
              {error()}
            </div>
          )}

          <button
            type="submit"
            disabled={loading()}
            class="w-full bg-accent hover:bg-accent-hover text-accent-text font-bold py-3 rounded-xl transition-all shadow-lg shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading() ? t("signing_in") : t("sign_in")}
          </button>
        </form>

        {/* Dev mode helper - only show on localhost */}
        {window.location.hostname === "localhost" && (
          <div class="mt-6 pt-6 border-t border-border-secondary">
            <p class="text-xs text-text-tertiary mb-1 text-center font-medium">
              🔧 Dev Mode: Paste Cookies
            </p>
            <p class="text-xs text-text-tertiary mb-3 text-center opacity-75">
              Format: 4603|xxx หรือ tsm=4603|xxx (วาง tsm token พอ)
            </p>
            <div class="flex flex-col gap-2">
              <textarea
                id="dev-cookie-input"
                placeholder="Paste tsm token (e.g., 4603|xxx or tsm=4603|xxx)"
                rows="3"
                class="w-full px-3 py-2 rounded-lg border border-border-primary bg-tertiary text-text-primary text-xs focus:border-accent outline-none resize-none"
              />
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById(
                    "dev-cookie-input",
                  ) as HTMLTextAreaElement;
                  if (input?.value) {
                    // Accept "Cookie: tsm=xxx; ...", "tsm=xxx", or a bare token "4603|xxx"
                    const raw = input.value.replace(/^Cookie:\s*/i, '').trim();

                    let tsm = '';
                    if (raw.includes('=')) {
                      raw.split(';').forEach(cookie => {
                        const idx = cookie.indexOf('=');
                        const name = cookie.slice(0, idx).trim();
                        if (name === 'tsm') tsm = cookie.slice(idx + 1).trim();
                      });
                    } else {
                      tsm = raw; // bare token pasted
                    }

                    // Cookie values are URL-encoded (| -> %7C); decode so Sanctum gets "4603|xxx"
                    try { tsm = decodeURIComponent(tsm); } catch { /* leave as-is */ }

                    if (tsm) {
                      setCookie("tsm", tsm);
                      console.log("Dev: tsm token set ->", tsm.substring(0, 12) + "...");
                      window.location.replace("/");
                    } else {
                      alert("วาง tsm token (เช่น 4603|xxx หรือ tsm=4603|xxx)");
                    }
                  }
                }}
                class="px-4 py-2 bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 rounded-lg text-xs font-medium transition-colors"
              >
                Set Cookies & Go
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
