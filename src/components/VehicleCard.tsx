import type { Component } from "solid-js";
import {
  createSignal,
  onCleanup,
  createEffect,
  createResource,
} from "solid-js";
import type { Vehicle, HistoryLog } from "../types";
import { api } from "../services/api";
import { mqttService, isMqttConnected } from "../services/mqttService";
import { t, locale } from "../i18n/config";
import Swal from "sweetalert2";

interface VehicleCardProps {
  vehicle: Vehicle;
  id?: string;
}

const VehicleCard: Component<VehicleCardProps> = (props) => {
  const [status, setStatus] = createSignal<"connected" | "disconnected">(
    "disconnected",
  );
  const [lastCommand, setLastCommand] = createSignal<string | null>(null);
  const [isSerialExpanded, setIsSerialExpanded] = createSignal(false);
  const [isExpanded, setIsExpanded] = createSignal(false);
  const [isOnline, setIsOnline] = createSignal(false);
  let heartbeatTimeout: number;

  const [latestData, setLatestData] = createSignal<any[] | null>(null);
  const [lastUpdate, setLastUpdate] = createSignal<Date | null>(null);
  const [timeAgo, setTimeAgo] = createSignal<string>("");
  const [dataChanged, setDataChanged] = createSignal<{
    [key: string]: boolean;
  }>({});

  const [recentHistory] = createResource(
    () => props.vehicle.serial_number,
    async (serialNumber) => {
      if (!serialNumber)
        return {
          data: [],
          meta: { total: 0, page: 1, limit: 3, totalPages: 1 },
        };
      return api.getHistory(1, 2, "", "", serialNumber);
    },
  );

  const parsedData = () => {
    const data = latestData();
    if (!data || data.length !== 5) return null;
    return {
      mode: data[0],
      temp: data[1],
      voltage: data[2],
      total_usage_time: data[3],
      session_usage: data[4],
    };
  };

  createEffect(() => {
    const interval = setInterval(() => {
      const last = lastUpdate();
      if (last) {
        const diff = Math.floor((new Date().getTime() - last.getTime()) / 1000);
        setTimeAgo(`${diff}s ${t("ago") || "ago"}`);
      }
    }, 1000);
    onCleanup(() => clearInterval(interval));
  });

  const mqttSerialNumber = props.vehicle.box_serial_number;
  const topic = mqttSerialNumber ? `vehicle/${mqttSerialNumber}/wrstatus` : "";
  const heartbeatTopic = mqttSerialNumber
    ? `vehicle/${mqttSerialNumber}/realtime_heartbeat`
    : "";

  const handleMessage = (topic: string, message: Buffer) => {
    if (topic === heartbeatTopic) {
      setIsOnline(true);
      setStatus("connected");
      try {
        const payload = JSON.parse(message.toString());
        if (payload.data && Array.isArray(payload.data)) {
          const oldData = latestData();
          const newData = payload.data;

          if (oldData && oldData.length === newData.length) {
            const changed: { [key: string]: boolean } = {};
            const fields = [
              "mode",
              "temp",
              "voltage",
              "total_usage_time",
              "session_usage",
            ];
            newData.forEach((val: any, idx: number) => {
              if (val !== oldData[idx]) {
                changed[fields[idx]] = true;
              }
            });
            setDataChanged(changed);
            setTimeout(() => setDataChanged({}), 1500);
          }

          setLatestData(newData);
          setLastUpdate(new Date());
          setTimeAgo(`0s ${t("ago") || "ago"}`);
        }
      } catch (e) {
        console.error("Failed to parse heartbeat:", e);
      }

      if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
      heartbeatTimeout = window.setTimeout(() => {
        setIsOnline(false);
      }, 15000);
    }
  };

  createEffect(() => {
    if (mqttSerialNumber) {
      mqttService.subscribe(heartbeatTopic, handleMessage);
    }

    onCleanup(() => {
      if (mqttSerialNumber) {
        mqttService.unsubscribe(heartbeatTopic, handleMessage);
      }
      if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
    });
  });

  const sendCommand = async (isOpen: boolean) => {
    const result = await Swal.fire({
      title: isOpen
        ? t("confirm_activate_title")
        : t("confirm_deactivate_title"),
      html: `${isOpen ? t("confirm_activate_text") : t("confirm_deactivate_text")}<br/><span class="text-orange-500 font-bold">(Serial Number: ${props.vehicle.serial_number})</span>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: isOpen ? "#10b981" : "#f43f5e",
      cancelButtonColor: "#6b7280",
      confirmButtonText: t("confirm_yes"),
      cancelButtonText: t("confirm_cancel"),
      customClass: {
        popup:
          "!bg-secondary !text-text-primary border !border-border-primary rounded-xl",
        title: "!text-text-primary",
        htmlContainer: "!text-text-secondary",
      },
    });

    if (!result.isConfirmed) return;

    if (!mqttSerialNumber) return;

    const payload = JSON.stringify({
      model: props.vehicle.model_code,
      status: isOpen ? 4 : 0,
    });

    mqttService.publish(topic, payload, { qos: 0 });

    setLastCommand(isOpen ? "OPEN" : "CLOSE");
    api.logAction(
      isOpen ? "OPEN_COMMAND" : "CLOSE_COMMAND",
      `Sent ${isOpen ? "OPEN" : "CLOSE"} command to vehicle ${mqttSerialNumber}`,
      props.vehicle.fb_id,
      props.vehicle.fp_id,
    );
    setTimeout(() => setLastCommand(null), 2000);

    Swal.fire({
      title: t("success_title"),
      text: isOpen ? t("success_activate_text") : t("success_deactivate_text"),
      icon: "success",
      timer: 2000,
      showConfirmButton: false,
      customClass: {
        popup:
          "!bg-secondary !text-text-primary border !border-border-primary rounded-xl",
        title: "!text-text-primary",
        htmlContainer: "!text-text-secondary",
      },
    });
  };

  const getModeInfo = (mode: number) => {
    switch (mode) {
      case 0:
        return {
          label: t("offline"),
          color: "text-gray-600",
          bg: "bg-gray-100",
          border: "border-gray-300",
        };
      case 1:
        return {
          label: t("mode_working"),
          color: "text-green-700",
          bg: "bg-green-50",
          border: "border-green-200",
        };
      case 2:
        return {
          label: t("mode_stop_relay1"),
          color: "text-orange-700",
          bg: "bg-orange-50",
          border: "border-orange-200",
        };
      case 3:
        return {
          label: t("mode_stop_relay2"),
          color: "text-red-700",
          bg: "bg-red-50",
          border: "border-red-200",
        };
      case 6:
        return {
          label: t("mode_pm"),
          color: "text-blue-700",
          bg: "bg-blue-50",
          border: "border-blue-200",
        };
      default:
        return {
          label: `${t("mode")} ${mode}`,
          color: "text-text-secondary",
          bg: "bg-tertiary",
          border: "border-border-secondary",
        };
    }
  };

  return (
    <div
      id={props.id}
      class="bg-secondary rounded-xl border border-border-primary transition-all duration-300 overflow-hidden hover:shadow-xl flex flex-col justify-between"
    >
      {/* Header Section */}
      <div class="p-5 border-b border-border-secondary">
        <div class="flex items-start justify-between gap-4 mb-3">
          <div class="flex-1 min-w-0">
            <h3
              class={`text-lg font-bold text-text-primary mb-1 cursor-pointer hover:text-accent transition-colors flex items-center gap-2 ${
                isSerialExpanded() ? "whitespace-normal break-all" : "truncate"
              }`}
              onClick={() => setIsSerialExpanded(!isSerialExpanded())}
              title={props.vehicle.serial_number}
            >
              <span class="text-xs font-semibold text-accent uppercase tracking-wide  px-2 py-1 rounded border border-orange-200">
                SN
              </span>
              {props.vehicle.serial_number}
            </h3>
            <p
              class={`text-sm text-text-secondary cursor-pointer hover:text-text-primary transition-colors ${
                isExpanded() ? "whitespace-normal" : "truncate"
              }`}
              onClick={() => setIsExpanded(!isExpanded())}
              title={String(props.vehicle.model)}
            >
              {props.vehicle.model}
            </p>
          </div>

          <span
            class={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide border ${
              props.vehicle.status === "active"
                ? "bg-green-50 text-green-700 border-green-200"
                : props.vehicle.status === "maintenance"
                  ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                  : "bg-red-50 text-red-700 border-red-200"
            }`}
          >
            {props.vehicle.status === "active"
              ? t("status_active")
              : props.vehicle.status === "maintenance"
                ? t("status_maintenance")
                : t("status_inactive")}
          </span>
        </div>

        {/* Meta Information */}
        <div class="flex flex-wrap gap-2">
          {/* {props.vehicle.fleet_product?.fleet_name && (
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-gray-50 text-text-secondary border border-gray-200">
              <span class="opacity-70">🏢</span>
              {props.vehicle.fleet_product.fleet_name}
            </span>
          )} */}
          {props.vehicle.box_serial_number && (
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-secondary text-text-tertiary border border-gray-200 font-mono">
              <span class="text-[10px] text-accent font-semibold uppercase tracking-wide bg-secondary px-1.5 py-0.5 rounded border border-secondary">
                BOX
              </span>
              {props.vehicle.box_serial_number}
            </span>
          )}
          <span
            class={`tour-status-badge inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
              status() === "connected"
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-gray-100 text-gray-600 border-gray-200"
            }`}
          >
            <div
              class={`w-1.5 h-1.5 rounded-full ${
                isOnline()
                  ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(76,175,80,0.6)]"
                  : "bg-gray-400"
              }`}
            ></div>
            {status() === "connected" ? t("connected") : t("offline")}
          </span>
        </div>
      </div>

      {/* Live Data Section */}
      {isOnline() && (
        <div class="px-5 py-4 bg-gradient-to-br from-orange-50/30 to-transparent border-b border-border-secondary">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <div class="relative flex h-2.5 w-2.5">
                <span
                  class={`absolute inline-flex h-full w-full rounded-full ${
                    parsedData()
                      ? "animate-ping bg-green-400 opacity-75"
                      : "bg-yellow-400 opacity-40"
                  }`}
                ></span>
                <span
                  class={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    parsedData() ? "bg-green-500" : "bg-yellow-500"
                  }`}
                ></span>
              </div>
              <span
                class={`text-xs font-semibold uppercase tracking-wide ${
                  parsedData() ? "text-green-600" : "text-yellow-600"
                }`}
              >
                {parsedData() ? t("live_telemetry") : t("waiting")}
              </span>
            </div>
            {parsedData() && (
              <span class="text-[10px] text-text-tertiary font-mono bg-white px-2 py-1 rounded border border-gray-200">
                {timeAgo()}
              </span>
            )}
          </div>

          {parsedData() ? (
            <div class="grid grid-cols-2 gap-3">
              {/* Mode */}
              <div
                class={`bg-white rounded-lg p-3 border border-gray-200 transition-all duration-300 ${
                  dataChanged()["mode"]
                    ? "ring-2 ring-orange-300 shadow-lg shadow-orange-100 scale-105"
                    : ""
                }`}
              >
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-lg">⚙️</span>
                  <span class="text-[10px] text-text-tertiary uppercase tracking-wide font-semibold">
                    {t("mode")}
                  </span>
                </div>
                <div class="flex flex-col gap-1">
                  <span class="text-2xl font-bold text-text-primary font-mono">
                    {parsedData()?.mode}
                  </span>
                  <span
                    class={`text-[10px] px-2 py-1 rounded border w-fit font-medium ${
                      getModeInfo(parsedData()!.mode).bg
                    } ${getModeInfo(parsedData()!.mode).color} ${
                      getModeInfo(parsedData()!.mode).border
                    }`}
                  >
                    {getModeInfo(parsedData()!.mode).label}
                  </span>
                </div>
              </div>

              {/* Temperature */}
              <div
                class={`bg-white rounded-lg p-3 border border-gray-200 transition-all duration-300 ${
                  dataChanged()["temp"]
                    ? "ring-2 ring-orange-300 shadow-lg shadow-orange-100 scale-105"
                    : ""
                }`}
              >
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-lg">🌡️</span>
                  <span class="text-[10px] text-text-tertiary uppercase tracking-wide font-semibold">
                    {t("temperature")}
                  </span>
                </div>
                <div class="flex items-baseline gap-1 mb-2">
                  <span class="text-2xl font-bold text-text-primary font-mono">
                    {parsedData()?.temp}
                  </span>
                  <span class="text-sm text-text-secondary">°C</span>
                </div>
                <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    class={`h-full rounded-full transition-all duration-500 ${
                      parsedData()!.temp > 40
                        ? "bg-red-500"
                        : parsedData()!.temp > 30
                          ? "bg-orange-500"
                          : "bg-green-500"
                    }`}
                    style={`width: ${Math.min(100, (parsedData()!.temp / 50) * 100)}%`}
                  ></div>
                </div>
              </div>

              {/* Voltage */}
              <div
                class={`bg-white rounded-lg p-3 border border-gray-200 transition-all duration-300 ${
                  dataChanged()["voltage"]
                    ? "ring-2 ring-yellow-300 shadow-lg shadow-yellow-100 scale-105"
                    : ""
                }`}
              >
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-lg">⚡</span>
                  <span class="text-[10px] text-text-tertiary uppercase tracking-wide font-semibold">
                    {t("voltage")}
                  </span>
                </div>
                <div class="flex items-baseline gap-1 mb-2">
                  <span class="text-2xl font-bold text-text-primary font-mono">
                    {parsedData()?.voltage}
                  </span>
                  <span class="text-sm text-text-secondary">V</span>
                </div>
                <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    class={`h-full rounded-full transition-all duration-500 ${
                      parsedData()!.voltage < 20
                        ? "bg-red-500"
                        : parsedData()!.voltage < 22
                          ? "bg-yellow-500"
                          : "bg-green-500"
                    }`}
                    style={`width: ${Math.min(100, (parsedData()!.voltage / 30) * 100)}%`}
                  ></div>
                </div>
              </div>

              {/* Session Usage */}
              <div
                class={`bg-white rounded-lg p-3 border border-gray-200 transition-all duration-300 ${
                  dataChanged()["session_usage"]
                    ? "ring-2 ring-purple-300 shadow-lg shadow-purple-100 scale-105"
                    : ""
                }`}
              >
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-lg">⏱️</span>
                  <span class="text-[10px] text-text-tertiary uppercase tracking-wide font-semibold">
                    {t("session")}
                  </span>
                </div>
                <div class="flex items-baseline gap-1">
                  <span class="text-2xl font-bold text-text-primary font-mono">
                    {Math.floor(parsedData()!.session_usage / 60)}
                  </span>
                  <span class="text-sm text-text-secondary">m</span>
                  <span class="text-lg font-bold text-text-primary font-mono ml-1">
                    {parsedData()!.session_usage % 60}
                  </span>
                  <span class="text-sm text-text-secondary">s</span>
                </div>
              </div>

              {/* Total Usage Time */}
              <div
                class={`col-span-2 bg-white rounded-lg p-3 border border-gray-200 transition-all duration-300 ${
                  dataChanged()["total_usage_time"]
                    ? "ring-2 ring-cyan-300 shadow-lg shadow-cyan-100 scale-105"
                    : ""
                }`}
              >
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-lg">📊</span>
                  <span class="text-[10px] text-text-tertiary uppercase tracking-wide font-semibold">
                    {t("total_usage_time")}
                  </span>
                </div>
                <div class="flex items-baseline gap-2">
                  <span class="text-2xl font-bold text-text-primary font-mono">
                    {Math.floor(parsedData()!.total_usage_time / 60)}
                  </span>
                  <span class="text-sm text-text-secondary">
                    {t("minutes")}
                  </span>
                  <span class="text-lg font-bold text-text-primary font-mono">
                    {parsedData()!.total_usage_time % 60}
                  </span>
                  <span class="text-sm text-text-secondary">
                    {t("seconds")}
                  </span>
                  <span class="ml-auto text-xs text-text-tertiary bg-gray-50 px-2 py-1 rounded border border-gray-200">
                    {(parsedData()!.total_usage_time / 3600).toFixed(2)}{" "}
                    {t("hours") || "hrs"}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div class="font-mono text-xs text-text-secondary bg-white px-3 py-2.5 rounded-lg border border-gray-200 text-center">
              {t("listening_heartbeat")}
            </div>
          )}
        </div>
      )}

      {/* Recent History Section */}
      {recentHistory() && recentHistory()!.data.length > 0 && (
        <div class="px-5 py-3">
          <div class="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
            <div class="px-3 py-2 border-b border-gray-200 flex items-center">
              <span class="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                {t("recent_activity")}
              </span>
              <span class="text-[10px] text-text-tertiary bg-white px-2 py-0.5 rounded border border-gray-200 ml-auto">
                {recentHistory()!.meta.total} {t("total")}
              </span>
            </div>
            <div class="divide-y divide-gray-200">
              {recentHistory()!
                .data.slice(0, 3)
                .map((log: HistoryLog) => {
                  const isOpen = log.action.includes("OPEN");
                  return (
                    <div class="px-3 py-2 hover:bg-white transition-colors">
                      <div class="flex items-center gap-2">
                        <div
                          class={`w-6 h-6 rounded-md flex items-center justify-center ${
                            isOpen
                              ? "bg-green-50 text-green-600"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          <svg
                            class="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            {isOpen ? (
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M5 13l4 4L19 7"
                              ></path>
                            ) : (
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M6 18L18 6M6 6l12 12"
                              ></path>
                            )}
                          </svg>
                        </div>
                        <div class="flex-1 min-w-0">
                          <p class="text-xs font-medium text-text-primary truncate">
                            {log.details}
                          </p>
                          <p class="text-[10px] text-text-tertiary">
                            {new Date(log.created_at).toLocaleString(
                              locale() == "th"
                                ? "th-TH"
                                : locale() == "ja"
                                  ? "ja-JP"
                                  : "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Action Section */}
      <div class="p-5 space-y-3">
        <div class="tour-controls grid grid-cols-2 gap-3">
          <button
            onClick={() => sendCommand(true)}
            disabled={!isMqttConnected()}
            class="group rounded-lg border-2 border-border-primary hover:bg-green-50 hover:border-green-300 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed py-2.5"
          >
            <div class="flex items-center justify-center gap-2">
              <div class="text-green-600 group-hover:scale-110 transition-all duration-200">
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
                    d="M5 13l4 4L19 7"
                  ></path>
                </svg>
              </div>
              <span class="text-green-700 font-semibold text-sm">
                {t("activate_vehicle")}
              </span>
            </div>
          </button>

          <button
            onClick={() => sendCommand(false)}
            disabled={!isMqttConnected()}
            class="group rounded-lg border-2 border-border-primary hover:bg-red-50 hover:border-red-300 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed py-2.5"
          >
            <div class="flex items-center justify-center gap-2">
              <div class="text-red-600 group-hover:scale-110 transition-all duration-200">
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
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </div>
              <span class="text-red-600 font-semibold text-sm">
                {t("deactivate_vehicle")}
              </span>
            </div>
          </button>
        </div>

        <a
          href={`/history?search=${props.vehicle.serial_number}`}
          class="bg-accent tour-history-link flex items-center justify-center gap-2 py-3 text-sm font-semibold text-accent-text hover:bg-accent-hover rounded-lg transition-all duration-200 group shadow-sm"
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
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          {t("view_history_log")}
        </a>
      </div>

      {/* Command Feedback */}
      {lastCommand() && (
        <div class="absolute top-4 right-4 bg-accent text-accent-text px-4 py-2 rounded-lg text-xs font-semibold shadow-lg animate-bounce z-20 flex items-center gap-2">
          <span>{lastCommand()}</span>
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
              d="M5 13l4 4L19 7"
            ></path>
          </svg>
        </div>
      )}
    </div>
  );
};

export default VehicleCard;
