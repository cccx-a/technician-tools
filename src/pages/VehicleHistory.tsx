import {
  createResource,
  For,
  Show,
  createSignal
} from "solid-js";
import {
  useNavigate,
  useSearchParams
} from "@solidjs/router";
import { api } from "../services/api";
import { t } from "../i18n/config";
// import LanguageSelector from "../components/LanguageSelector";
import { useTheme } from "../stores/theme";
// import OnboardingTour from "../components/OnboardingTour";
// import type { TourStep } from "../components/OnboardingTour";
import { LIFTNGO_URL } from "../services/api";

const VehicleHistory = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = createSignal(1);
  useTheme();

  // const getThemeIcon = () => {
  //   switch (theme()) {
  //     case "light":
  //       return "☀️";
  //     case "dark":
  //       return "🌙";
  //     case "gruvbox":
  //       return "🌲";
  //     case "orange":
  //       return "🔥";
  //     default:
  //       return "☀️";
  //   }
  // };

  const handleComeback = () => {
    //redirect to dashboard domain : liftngo
    const storedPath = localStorage.getItem("liftngo_return_path");
    const targetPath = storedPath || "/dashboard";
    window.location.href = `${LIFTNGO_URL}${targetPath}`;
  };

  // Default date range: if searching by serial, use 30 days; otherwise 24 hours
  const getDefaultDates = () => {
    const now = new Date();
    const defaultDaysBack = searchParams.search ? 30 : 1;
    const defaultStart = new Date(
      now.getTime() - defaultDaysBack * 24 * 60 * 60 * 1000,
    );

    // Format for datetime-local input (YYYY-MM-DDTHH:mm)
    return {
      start: defaultStart.toISOString().slice(0, 16),
      end: now.toISOString().slice(0, 16),
    };
  };

  const defaults = getDefaultDates();
  const [startDate, setStartDate] = createSignal(defaults.start);
  const [endDate, setEndDate] = createSignal(defaults.end);
  const [searchTerm, setSearchTerm] = createSignal(searchParams.search || "");

  const [historyData] = createResource(
    () => ({
      page: page(),
      start: startDate(),
      end: endDate(),
      search: searchTerm(),
    }),
    async ({ page, start, end, search }) => {
      // แปลง datetime-local เป็น ISO string
      const startISO = new Date(start).toISOString();
      const endISO = new Date(end).toISOString();

      // console.log('Fetching history:', { page, startISO, endISO, search });
      const result = await api.getHistory(page, 5, startISO, endISO, search);
      // console.log('History result:', result);
      return result;
    },
  );

  const logs = () => historyData()?.data || [];
  const meta = () =>
    historyData()?.meta || { total: 0, page: 1, limit: 5, totalPages: 1 };

  const handlePrevPage = () => {
    if (page() > 1) setPage((p) => p - 1);
  };

  const handleNextPage = () => {
    if (page() < meta().totalPages) setPage((p) => p + 1);
  };

  const goToPage = (pageNum: number) => {
    setPage(pageNum);
  };

  const applyFilters = () => {
    setPage(1);
    setSearchParams({ search: searchTerm() });
  };

  const clearFilters = () => {
    const defaults = getDefaultDates();
    setStartDate(defaults.start);
    setEndDate(defaults.end);
    setSearchTerm("");
    setPage(1);
    setSearchParams({});
  };

  const setQuickFilter = (hours: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
    setStartDate(start.toISOString().slice(0, 16));
    setEndDate(end.toISOString().slice(0, 16));
    setPage(1);
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const total = meta().totalPages;
    const current = page();
    const pages: (number | string)[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push("...");
      for (
        let i = Math.max(2, current - 1);
        i <= Math.min(total - 1, current + 1);
        i++
      ) {
        pages.push(i);
      }
      if (current < total - 2) pages.push("...");
      pages.push(total);
    }
    return pages;
  };

  // const tourSteps: TourStep[] = [
  //   {
  //     title: t("tour_history_title"),
  //     content: t("tour_history_content"),
  //     position: "bottom",
  //   },
  //   {
  //     target: "#tour-filter-24h",
  //     title: t("tour_filter_24h_title"),
  //     content: t("tour_filter_24h_content"),
  //     position: "bottom",
  //   },
  //   {
  //     target: "#tour-filter-7d",
  //     title: t("tour_filter_7d_title"),
  //     content: t("tour_filter_7d_content"),
  //     position: "bottom",
  //   },
  //   {
  //     target: "#tour-filter-30d",
  //     title: t("tour_filter_30d_title"),
  //     content: t("tour_filter_30d_content"),
  //     position: "bottom",
  //   },
  //   {
  //     target: "#tour-filter-clear",
  //     title: t("tour_filter_clear_title"),
  //     content: t("tour_filter_clear_content"),
  //     position: "bottom",
  //   },
  //   {
  //     target: "#tour-search-input",
  //     title: t("tour_search_serial_title"),
  //     content: t("tour_search_serial_content"),
  //     position: "bottom",
  //   },
  //   {
  //     target: "#tour-date-range",
  //     title: t("tour_date_range_title"),
  //     content: t("tour_date_range_content"),
  //     position: "bottom",
  //   },
  //   {
  //     target: "#tour-history-list",
  //     title: t("tour_activity_list_title"),
  //     content: t("tour_activity_list_content"),
  //     position: "top",
  //   },
  //   {
  //     target: "#tour-history-pagination",
  //     title: t("tour_pagination_title"),
  //     content: t("tour_pagination_content"),
  //     position: "top",
  //   },
  // ];

  return (
    <div class="min-h-screen bg-primary transition-colors duration-300">
      {/* <OnboardingTour steps={tourSteps} tourKey="history_v1" /> */}
      <header class="bg-secondary border-b border-border-primary sticky top-0 z-50 shadow-sm">
        <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <button
              onClick={() => {
                navigate("/");
              }}
              class="p-2 rounded-full hover:bg-tertiary text-text-secondary transition-colors"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                ></path>
              </svg>
            </button>
            <div>
              <h1 class="text-xl font-bold text-text-primary">
                {t("system_history_log")}
              </h1>
              <p class="text-xs text-text-tertiary hidden sm:block">
                {t("view_filter_activities")}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-4">
            {searchTerm() && (
              <div class="hidden md:flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-lg px-3 py-1.5">
                <svg
                  class="w-4 h-4 text-accent"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  ></path>
                </svg>
                <span class="text-xs font-medium text-accent">
                  {t("filtered")}: {searchTerm()}
                </span>
              </div>
            )}
            {/* <LanguageSelector />
            <button
              id="tour-theme-toggle"
              onClick={toggleTheme}
              class="p-2 rounded-lg hover:bg-tertiary text-text-secondary transition-colors"
              title={t("theme_toggle")}
            >
              {getThemeIcon()}
            </button> */}
            <button
              onClick={handleComeback}
              class="bg-red-500/10 text-red-500 hover:bg-red-500/20 px-3 py-2 md:px-4 md:py-2 rounded-lg text-sm font-medium transition-colors"
              title={t("comeback")}
            >
              <span class="md:hidden">
                <svg
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  ></path>
                </svg>
              </span>
              <span class="hidden md:inline">{t("comeback")}</span>
            </button>
          </div>
        </div>
      </header>

      <main class="max-w-6xl mx-auto px-4 py-8">
        <div class="bg-secondary rounded-xl shadow-sm border border-border-primary overflow-hidden">
          {/* Filters */}
          <div
            id="tour-history-filters"
            class="p-6 border-b border-border-secondary bg-gradient-to-br from-tertiary/30 to-tertiary/10"
          >
            {/* Quick Filters */}
            <div
              id="tour-quick-filters"
              class="mb-4 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none"
            >
              <div class="flex items-center gap-2 shrink-0">
                <span class="hidden sm:inline text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap">
                  {t("quick_filter")}:
                </span>
                <span
                  class="sm:hidden text-text-secondary p-1 bg-tertiary rounded-md"
                  title={t("quick_filter")}
                >
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                    />
                  </svg>
                </span>
                <button
                  id="tour-filter-24h"
                  onClick={() => setQuickFilter(24)}
                  class="shrink-0 px-3 py-1 text-xs font-medium bg-tertiary hover:bg-accent text-text-primary hover:text-accent-text border border-border-primary rounded-lg transition-colors whitespace-nowrap"
                >
                  {t("last_24h")}
                </button>
                <button
                  id="tour-filter-7d"
                  onClick={() => setQuickFilter(24 * 7)}
                  class="shrink-0 px-3 py-1 text-xs font-medium bg-tertiary hover:bg-accent text-text-primary hover:text-accent-text border border-border-primary rounded-lg transition-colors whitespace-nowrap"
                >
                  {t("last_7d")}
                </button>
                <button
                  id="tour-filter-30d"
                  onClick={() => setQuickFilter(24 * 30)}
                  class="shrink-0 px-3 py-1 text-xs font-medium bg-tertiary hover:bg-accent text-text-primary hover:text-accent-text border border-border-primary rounded-lg transition-colors whitespace-nowrap"
                >
                  {t("last_30d")}
                </button>
              </div>
              <button
                id="tour-filter-clear"
                onClick={clearFilters}
                class="ml-auto shrink-0 px-3 py-1 text-xs font-medium text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 rounded-lg transition-colors whitespace-nowrap"
              >
                {t("clear_all")}
              </button>
            </div>

            {/* Custom Filters */}
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div id="tour-search-input" class="md:col-span-1">
                <label class="block text-xs font-medium text-text-secondary mb-1.5">
                  🔍 {t("search_serial_product")}
                </label>
                <input
                  type="text"
                  value={searchTerm()}
                  onInput={(e) => setSearchTerm(e.currentTarget.value)}
                  placeholder={t("search_serial_product")}
                  class="w-full bg-tertiary border border-border-primary rounded-lg px-3 py-2.5 text-sm text-text-primary focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                />
              </div>
              <div id="tour-date-range">
                <label class="block text-xs font-medium text-text-secondary mb-1.5">
                  📅 {t("start_date")}
                </label>
                <input
                  type="datetime-local"
                  value={startDate()}
                  onInput={(e) => setStartDate(e.currentTarget.value)}
                  class="w-full bg-tertiary border border-border-primary rounded-lg px-3 py-2.5 text-sm text-text-primary focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-text-secondary mb-1.5">
                  📅 {t("end_date")}
                </label>
                <input
                  type="datetime-local"
                  value={endDate()}
                  onInput={(e) => setEndDate(e.currentTarget.value)}
                  class="w-full bg-tertiary border border-border-primary rounded-lg px-3 py-2.5 text-sm text-text-primary focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                />
              </div>
              <button
                onClick={applyFilters}
                class="px-6 py-2.5 bg-accent text-accent-text rounded-lg text-sm font-bold hover:bg-accent-hover transition-all shadow-lg shadow-accent/20 hover:shadow-accent/30 hover:scale-105 active:scale-95"
              >
                {t("apply_filters")}
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <Show when={!historyData.loading && logs().length > 0}>
            <div class="px-6 py-3 bg-tertiary/20 border-b border-border-secondary flex items-center justify-between text-xs">
              <div class="flex items-center gap-4">
                <span class="text-text-secondary">
                  <span class="font-bold text-accent">{meta().total}</span>{" "}
                  {t("total_records")}
                </span>
                <span class="text-text-tertiary">•</span>
                <span class="text-text-secondary">
                  {t("showing")}{" "}
                  <span class="font-bold">
                    {(meta().page - 1) * meta().limit + 1}
                  </span>{" "}
                  -{" "}
                  <span class="font-bold">
                    {Math.min(meta().page * meta().limit, meta().total)}
                  </span>
                </span>
              </div>
              <div class="text-text-tertiary">
                Page {meta().page} of {meta().totalPages}
              </div>
            </div>
          </Show>

          {/* List */}
          <div id="tour-history-list" class="divide-y divide-border-secondary">
            <Show
              when={!historyData.loading}
              fallback={
                <div class="p-16 text-center">
                  <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
                  <p class="text-text-tertiary font-medium">
                    {t("loading_history")}
                  </p>
                </div>
              }
            >
              <For each={logs()}>
                {(log) => (
                  <div class="p-4 hover:bg-tertiary/5 transition-colors group border-b border-border-secondary last:border-0">
                    <div class="flex items-start gap-4">
                      {/* Icon based on action */}
                      <div
                        class={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${log.action.includes("OPEN") ||
                          log.action.includes("ACTIVATE")
                          ? "bg-emerald-500/10 text-emerald-500"
                          : log.action.includes("CLOSE") ||
                            log.action.includes("DEACTIVATE")
                            ? "bg-rose-500/10 text-rose-500"
                            : "bg-accent/10 text-accent"
                          }`}
                      >
                        <Show
                          when={
                            log.action.includes("OPEN") ||
                            log.action.includes("ACTIVATE")
                          }
                          fallback={
                            <Show
                              when={
                                log.action.includes("CLOSE") ||
                                log.action.includes("DEACTIVATE")
                              }
                              fallback={
                                <svg
                                  class="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                  ></path>
                                </svg>
                              }
                            >
                              <svg
                                class="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                                ></path>
                              </svg>
                            </Show>
                          }
                        >
                          <svg
                            class="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            ></path>
                          </svg>
                        </Show>
                      </div>

                      {/* Content */}
                      <div class="flex-1 min-w-0">
                        <div class="flex items-start justify-between gap-4">
                          <div>
                            <p class="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
                              {log.action}
                            </p>
                            <p class="text-xs text-text-secondary mt-0.5 line-clamp-1">
                              {log.details}
                            </p>
                          </div>
                          <span class="text-xs font-medium text-text-tertiary whitespace-nowrap bg-background border border-border-secondary px-2 py-1 rounded-md">
                            {new Date(log.created_at).toLocaleString("th-TH", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        {/* User Info */}
                        <div class="mt-2 flex items-center gap-2">
                          {/* <div class="w-5 h-5 rounded-full bg-tertiary/20 flex items-center justify-center text-[10px] font-bold text-text-secondary">
                                                        {log.user?.firstname?.[0] || 'U'}
                                                    </div> */}
                          <span class="text-xs text-text-secondary">
                            {t("by")}{" "}
                            <span class="font-medium text-text-primary">
                              {log.user
                                ? `${log.user.titlename || ""} ${log.user.firstname} ${log.user.lastname}`.trim()
                                : t("unknown_user")}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </For>
              {logs().length === 0 && (
                <div class="p-16 text-center text-text-tertiary">
                  <div class="text-6xl mb-4">📜</div>
                  <p class="text-lg font-medium mb-2">
                    {t("no_history_found")}
                  </p>
                  <p class="text-sm">{t("adjust_filters")}</p>
                </div>
              )}
            </Show>
          </div>

          {/* Enhanced Pagination */}
          <Show when={!historyData.loading && logs().length > 0}>
            <div
              id="tour-history-pagination"
              class="p-4 border-t border-border-secondary bg-tertiary/30"
            >
              <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div class="text-xs text-text-secondary">
                  Page{" "}
                  <span class="font-bold text-text-primary">{meta().page}</span>{" "}
                  of{" "}
                  <span class="font-bold text-text-primary">
                    {meta().totalPages}
                  </span>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    onClick={handlePrevPage}
                    disabled={page() === 1}
                    class="px-3 py-2 rounded-lg bg-tertiary border border-border-primary text-text-primary text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent hover:text-accent-text hover:border-accent transition-all"
                  >
                    ← {t("previous")}
                  </button>

                  <div class="hidden md:flex items-center gap-1">
                    {getPageNumbers().map((pageNum) =>
                      typeof pageNum === "number" ? (
                        <button
                          onClick={() => goToPage(pageNum)}
                          class={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${page() === pageNum
                            ? "bg-accent text-accent-text shadow-lg shadow-accent/30"
                            : "bg-background text-text-primary hover:bg-tertiary border border-border-primary"
                            }`}
                        >
                          {pageNum}
                        </button>
                      ) : (
                        <span class="px-2 text-text-tertiary">...</span>
                      ),
                    )}
                  </div>

                  <button
                    onClick={handleNextPage}
                    disabled={page() === meta().totalPages}
                    class="px-3 py-2 rounded-lg bg-tertiary border border-border-primary text-text-primary text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent hover:text-accent-text hover:border-accent transition-all"
                  >
                    {t("next")} →
                  </button>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </main>
    </div>
  );
};

export default VehicleHistory;
