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

    // Check token types
    const isLocalJwt = existingToken && isValidJWT(existingToken);
    const isLiftngoToken = existingToken && /^\d+\|/.test(existingToken);
    const isEncryptedCookie = existingToken && isLaravelEncryptedCookie(existingToken);

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
    } else if (isEncryptedCookie) {
      // This is a Laravel encrypted cookie - redirect to dashboard for cookie auth
      console.log(
        "Login page: Laravel encrypted cookie found, redirecting to dashboard for cookie auth",
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
              Format: tsm=xxx; liftngo_session=yyy
            </p>
            <div class="flex flex-col gap-2">
              <textarea
                id="dev-cookie-input"
                placeholder="Paste Cookie header here (e.g., tsm=xxx; liftngo_session=yyy)"
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
                    // Parse cookies from input (supports formats: "tsm=xxx; liftngo_session=yyy" or "Cookie: tsm=xxx; ...")
                    const cookieString = input.value.replace(/^Cookie:\s*/i, '').trim();
                    const cookies = cookieString.split(';').map(c => c.trim());

                    let tsm = '';
                    let liftngoSession = '';

                    cookies.forEach(cookie => {
                      const [name, value] = cookie.split('=');
                      if (name === 'tsm') tsm = value;
                      if (name === 'liftngo_session') liftngoSession = value;
                    });

                    if (tsm && liftngoSession) {
                      setCookie("tsm", tsm);
                      setCookie("liftngo_session", liftngoSession);
                      console.log("Dev: Cookies set! tsm + liftngo_session");
                      window.location.replace("/");
                    } else {
                      alert("โปรดวาง cookies ทั้ง tsm และ liftngo_session\nรูปแบบ: tsm=xxx; liftngo_session=yyy");
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
