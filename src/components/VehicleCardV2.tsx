import {
  type Component,
  createSignal,
  onCleanup,
  createEffect,
} from "solid-js";
import type { Vehicle } from "../types";
import { api } from "../services/api";
import { isMqttConnected, mqttService } from "../services/mqttService";
import { t } from "../i18n/config";
import Swal from "sweetalert2";

interface VehicleCardV2Props {
  vehicle: Vehicle;
  id?: string;
}

const VehicleCardV2: Component<VehicleCardV2Props> = (props) => {
  const [status, setStatus] = createSignal<"connected" | "disconnected">(
    "disconnected",
  );
  const [, setIsOnline] = createSignal(false);

  // Data States
  const [latestData, setLatestData] = createSignal<any[] | null>(null);
  const [, setLastUpdate] = createSignal<Date | null>(null);

  let heartbeatTimeout: number;

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

  const mqttSerialNumber = props.vehicle.box_serial_number;
  // Topics
  const topic = mqttSerialNumber ? `vehicle/${mqttSerialNumber}/wrstatus` : "";
  const heartbeatTopic = mqttSerialNumber
    ? `vehicle/${mqttSerialNumber}/realtime_heartbeat`
    : "";

  // MQTT Message Handling
  const handleMessage = (topic: string, message: Buffer) => {
    if (topic === heartbeatTopic) {
      setIsOnline(true);
      setStatus("connected");
      try {
        const payload = JSON.parse(message.toString());
        if (payload.data && Array.isArray(payload.data)) {
          setLatestData(payload.data);
          setLastUpdate(new Date());
        }
      } catch (e) {
        console.error("Failed to parse heartbeat:", e);
      }

      if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
      heartbeatTimeout = window.setTimeout(() => {
        setIsOnline(false);
        setStatus("disconnected");
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

  const sendCommandLegacy = async (isOpen: boolean) => {
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

    api.logAction(
      isOpen ? "OPEN_COMMAND" : "CLOSE_COMMAND",
      `Sent ${isOpen ? "OPEN" : "CLOSE"} command to vehicle ${mqttSerialNumber}`,
      props.vehicle.fb_id,
      props.vehicle.fp_id,
    );

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

  // Helper to format time seconds -> HH:MM:SS
  // const formatTime = (seconds: number) => {
  //     const h = Math.floor(seconds / 3600);
  //     const m = Math.floor((seconds % 3600) / 60);
  //     const s = seconds % 60;
  //     return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  // };

  const getModeLabel = (mode: number) => {
    switch (mode) {
      case 0:
        return "ปิดใช้งาน";
      case 1:
        return "ทำงานปกติ";
      case 2:
        return "หยุด รีเลย์ 1 (ยกงา)";
      case 3:
        return "หยุด รีเลย์ 2 (ยกงา+เคลื่อนที่)";
      case 4:
        return "เปิดใข้สัญญาณรถ";
      case 5:
        return "⚠️ Credit ใกล้หมด";
      case 6:
        return "PM";
      default:
        return `Mode ${mode}`;
    }
  };

  const getModeStyle = (mode: number) => {
    switch (mode) {
      case 0:
        return "bg-red-100 text-red-700 border-red-300";
      case 1:
        return "bg-green-100 text-green-700 border-green-300";
      case 2:
        return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case 3:
        return "bg-orange-100 text-orange-700 border-orange-300";
      case 4:
        return "bg-green-100 text-green-700 border-green-300";
      case 5:
        return "bg-red-100 text-red-700 border-red-300";
      case 6:
        return "bg-purple-100 text-purple-700 border-purple-300";
      default:
        return "bg-gray-100 text-gray-600 border-gray-300";
    }
  };

  return (
    <div
      id={props.id}
      class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col h-full transition-all duration-200 hover:shadow-xl"
    >
      {/* Card Header */}
      <div class="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-white">
        <label class="font-bold text-sm text-gray-700">
          {props.vehicle.model || "คันกลาง"}
        </label>
        <span
          class={`badge px-2 py-0.5 rounded text-xs font-semibold ${
            status() === "connected"
              ? "bg-green-100 text-green-700 border border-green-200"
              : "bg-gray-100 text-gray-500 border border-gray-200"
          }`}
        >
          {status() === "connected" ? "Connecting" : "Offline"}
        </span>
      </div>

      {/* Card Body */}
      <div class="p-4 flex-1 flex flex-col">
        <div class="space-y-2">
          {/* Usage Time */}
          {/* <p class="text-[15px] text-gray-700 flex justify-between">
                        <span>เวลาการใช้งานสะสม:</span>
                        <span class="text-[#ff8952] font-medium">
                            {parsedData() ? formatTime(parsedData()!.total_usage_time) : "-"}
                        </span>
                    </p> */}

          {/* Session Time */}
          {/* <p class="text-[15px] text-gray-700 flex justify-between">
                        <span>เวลาใช้งานในรอบนี้:</span>
                        <span class="text-[#ff8952] font-medium">
                            {parsedData() ? formatTime(parsedData()!.session_usage) : "-"}
                        </span>
                    </p> */}

          {/* Temperature */}
          <p class="text-[15px] text-gray-700 flex justify-between">
            <span>อุณหภูมิ:</span>
            <span class="text-[#ff8952] font-medium">
              {parsedData() ? parsedData()!.temp : "-"}
            </span>
          </p>

          {/* Battery */}
          <p class="text-[15px] text-gray-700 flex justify-between">
            <span>แบตเตอรี่:</span>
            <span class="text-[#ff8952] font-medium">
              {parsedData() ? parsedData()!.voltage : "-"}
            </span>
          </p>

          {/* Status with colored badge */}
          <div class="text-[15px] text-gray-700 flex justify-between items-center">
            <span>สถานะ:</span>
            <span
              class={`px-2 py-0.5 rounded-md text-xs font-semibold border ${parsedData() ? getModeStyle(parsedData()!.mode) : "bg-gray-100 text-gray-500 border-gray-300"}`}
            >
              {parsedData() ? getModeLabel(parsedData()!.mode) : "-"}
            </span>
          </div>
        </div>

        {/* Image */}
        <div class="mt-4 text-center">
          <img
            src={props.vehicle.image || "/folklift-image-nobg.png"}
            alt={props.vehicle.model}
            class="w-[100px] h-[100px] object-contain mx-auto rounded-md"
            onError={(e) => (e.currentTarget.src = "/folklift-image-nobg.png")}
          />
        </div>

        {/* Serial Numbers */}
        <div class="mt-4 mb-3 space-y-1">
          <p class="text-sm text-gray-600 flex justify-between border-b border-dashed border-gray-200 pb-1">
            <span>S/N กล่อง:</span>
            <span class="font-mono text-gray-800">
              {props.vehicle.box_serial_number || "-"}
            </span>
          </p>
          <p class="text-sm text-gray-600 flex justify-between">
            <span>S/N รถ:</span>
            <span class="font-mono text-gray-800">
              {props.vehicle.serial_number}
            </span>
          </p>
        </div>

        {/* Controls */}
        {/* <div class="space-y-3 mt-4 pt-3 border-t border-gray-100">
                    <select
                        class="w-full form-select px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-400 outline-none transition-all"
                    >
                        <option value="0">เลือกสถานะ</option>
                        <option value="1">ทำงาน</option>
                        <option value="2">หยุด รีเลย์ 1 ตัว (ยกงา)</option>
                        <option value="3">หยุด รีเลย์ 2 ตัว (ยกงา, เคลื่อนที่)</option>
                        <option value="4">Service รีเลย์ ปิดหมด (พวก maintenance)</option>
                    </select>

                    <a
                        href={`/history?search=${props.vehicle.serial_number}`}
                        class="w-full btn bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg shadow-sm transition-colors duration-200 text-center block"
                    >
                        ดูประวัติ
                    </a>
                </div> */}

        {/* Legacy Actions */}
        <div class="space-y-3 mt-auto pt-3 border-t border-gray-100">
          <div class="grid grid-cols-2 gap-3">
            <button
              onClick={() => sendCommandLegacy(true)}
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
              onClick={() => sendCommandLegacy(false)}
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
            class="bg-accent flex items-center justify-center gap-2 py-3 text-sm font-semibold text-accent-text hover:bg-accent-hover rounded-lg transition-all duration-200 group shadow-sm"
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
      </div>
    </div>
  );
};

export default VehicleCardV2;
