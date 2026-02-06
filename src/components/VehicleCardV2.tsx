import {
  type Component,
  createSignal,
  onCleanup,
  createEffect,
  onMount,
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

  const [showCursor, setShowCursor] = createSignal(false);

  // Get user role from localStorage
  const getUserRoleId = () => {
    const userJson = localStorage.getItem('user');
    const user = userJson ? JSON.parse(userJson) : null;
    return user?.role_id || 0;
  };

  onMount(() => {
    setTimeout(() => setShowCursor(true), 500);
    setTimeout(() => setShowCursor(false), 3500);
  });

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

    // ส่ง 2 ครั้งเพื่อป้องกัน message loss (QoS 0)
    mqttService.publish(topic, payload, { qos: 0 });
    setTimeout(() => {
      mqttService.publish(topic, payload, { qos: 0 });
    }, 100);

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



  // const getModeLabel = (mode: number) => {
  //   switch (mode) {
  //     case 0:
  //       return "ปิดใช้งาน";
  //     case 1:
  //       return "ทำงานปกติ";
  //     case 2:
  //       return "หยุด รีเลย์ 1 (ยกงา)";
  //     case 3:
  //       return "หยุด รีเลย์ 2 (ยกงา+เคลื่อนที่)";
  //     case 4:
  //       return "เปิดใข้สัญญาณรถ";
  //     case 5:
  //       return "⚠️ Credit ใกล้หมด";
  //     case 6:
  //       return "PM";
  //     default:
  //       return `Mode ${mode}`;
  //   }
  // };

  // const getModeStyle = (mode: number) => {
  //   switch (mode) {
  //     case 0:
  //       return "bg-red-100 text-red-700 border-red-300";
  //     case 1:
  //       return "bg-green-100 text-green-700 border-green-300";
  //     case 2:
  //       return "bg-yellow-100 text-yellow-700 border-yellow-300";
  //     case 3:
  //       return "bg-orange-100 text-orange-700 border-orange-300";
  //     case 4:
  //       return "bg-green-100 text-green-700 border-green-300";
  //     case 5:
  //       return "bg-red-100 text-red-700 border-red-300";
  //     case 6:
  //       return "bg-purple-100 text-purple-700 border-purple-300";
  //     default:
  //       return "bg-gray-100 text-gray-600 border-gray-300";
  //   }
  // };

  const handleApproveVehicle = async () => {
    const result = await Swal.fire({
      title: "ยืนยันการ QC รถคันนี้",
      html: `คุณต้องการยืนยันว่ารถคันนี้ <br/><span class="text-orange-500 font-bold">(Serial Number: ${props.vehicle.serial_number})</span><br/>ใช้งานได้ปกติใช่หรือไม่?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "ใช่, ยืนยัน",
      cancelButtonText: "ยกเลิก",
      customClass: {
        popup: "rounded-xl",
        title: "text-lg font-bold text-gray-800",
        confirmButton: "rounded-lg px-6 py-2",
        cancelButton: "rounded-lg px-6 py-2"
      }
    });

    if (result.isConfirmed) {
      try {
        console.log('Approving vehicle - m_id:', props.vehicle.m_id, 'fp_id:', props.vehicle.fp_id, 'serial_number:', props.vehicle.serial_number);
        await api.approveVehicle(
          props.vehicle.fp_id,
          props.vehicle.serial_number,
          props.vehicle.m_id,  // m_id for external API
          props.vehicle.matching?.fb_id, // for history logging
          props.vehicle.fp_id  // for history logging
        );

        await Swal.fire({
          title: t("success_title") || "สำเร็จ",
          text: "บันทึกสถานะเรียบร้อยแล้ว",
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
          customClass: {
            popup: "rounded-xl"
          }
        });
      } catch (error) {
        console.error("Error approving vehicle:", error);
        await Swal.fire({
          title: "เกิดข้อผิดพลาด",
          text: "ไม่สามารถบันทึกสถานะได้ กรุณาลองใหม่อีกครั้ง",
          icon: "error",
          confirmButtonText: "ตกลง",
          customClass: {
            popup: "rounded-xl"
          }
        });
      }
    }
  };

  return (
    <div
      id={props.id}
      class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col h-full transition-all duration-200 hover:shadow-xl relative"
    >

      <div class="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-white gap-2">
        <label
          class="font-bold text-sm text-gray-700 truncate cursor-pointer hover:text-blue-600 transition-colors"
          title={String(props.vehicle.product_name || props.vehicle.model || "คันกลาง")}
          onClick={() => {
            Swal.fire({
              title: String(props.vehicle.product_name || props.vehicle.model || "คันกลาง"),
              text: "ชื่อรุ่นรถเต็ม",
              confirmButtonText: "ตกลง",
              confirmButtonColor: "#3b82f6",
              customClass: {
                popup: "rounded-xl",
                title: "text-lg font-bold text-gray-800",
                confirmButton: "rounded-lg px-6 py-2"
              }
            });
          }}
        >
          {props.vehicle.product_name || String(props.vehicle.model) || "คันกลาง"}
        </label>
        <span
          class={`badge px-3 py-1 rounded text-sm font-semibold whitespace-nowrap shrink-0 ${status() === "connected" && parsedData()?.mode !== 0
            ? "bg-green-100 text-green-700 border border-green-200"
            : "bg-gray-100 text-gray-500 border border-gray-200"
            }`}
        >
          {status() === "connected" && parsedData()?.mode !== 0 ? "เปิดใช้งาน" : "ปิดใช้งาน"}
        </span>
      </div>

      {/* Card Body */}
      <div class="p-4 flex-1 flex flex-col">
        <div class="space-y-2">


          {/* Temperature */}
          <p class="text-[15px] text-gray-700 flex justify-between whitespace-nowrap">
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

          {/* Match Process Status */}
          {getUserRoleId() === 18 && (() => {
            const getMatchProcessLabel = (process: number) => {
              switch (process) {
                case 1: return "รอประกอบ";
                case 2: return "ประกอบสำเร็จ";
                case 3: return "รอ QC";
                case 4: return "QC สำเร็จ";
                default: return "รอ PDI Assembly ประกอบรถ";
              }
            };

            const getMatchProcessStyle = (process: number) => {
              switch (process) {
                case 1: return "bg-blue-100 text-blue-700 border-blue-300";
                case 2: return "bg-yellow-100 text-yellow-700 border-yellow-300";
                case 3: return "bg-orange-100 text-orange-700 border-orange-300";
                case 4: return "bg-green-100 text-green-700 border-green-300";
                default: return "bg-gray-100 text-gray-600 border-gray-300";
              }
            };

            const getMatchProcessIcon = (process: number) => {
              switch (process) {
                case 1: return "📦";
                case 2: return "🔧";
                case 3: return "🔍";
                case 4: return "✅";
                default: return "⏳";
              }
            };

            const matchProcess = props.vehicle.match_process || 0;

            return (
              <div class="mt-3 pt-3 border-t border-dashed border-gray-200">
                {/* Status Label and Badge - Stacked for consistency */}
                <div class="flex flex-col gap-2">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-[13px] text-gray-600 shrink-0">สถานะ:</span>
                    <span class={`px-2 py-0.5 rounded text-[11px] font-semibold border whitespace-nowrap ${getMatchProcessStyle(matchProcess)}`}>
                      {getMatchProcessIcon(matchProcess)} {getMatchProcessLabel(matchProcess)}
                    </span>
                  </div>
                  {/* Progress Steps */}
                  <div class="flex items-center gap-0.5">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        class={`flex-1 h-1 rounded-full transition-all duration-300 ${step <= matchProcess
                          ? step === 4 ? "bg-green-500" : "bg-orange-400"
                          : "bg-gray-200"
                          }`}
                      />
                    ))}
                  </div>
                  {/* Step Labels */}
                  <div class="flex justify-between text-[9px] text-gray-400 -mt-1">
                    <span>PDI Assembly</span>
                    <span>PDI QC</span>
                    <span>QC Waiting</span>
                    <span>Complete</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Button approve product - Only show for role_id 18, only enabled when match_process === 2 */}
          {getUserRoleId() === 18 && (
            <div class="mt-2 pt-2 border-t border-dashed border-gray-200 relative">
              {props.vehicle.match_process === 4 ? (
                // Completed state - show success badge
                <div class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-100 text-green-700 border-2 border-green-300 rounded-lg text-sm font-bold">
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                  QC เสร็จสมบูรณ์
                </div>
              ) : (
                // Button for waiting or ready states
                <button
                  onClick={handleApproveVehicle}
                  disabled={props.vehicle.match_process !== 2}
                  class={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${props.vehicle.match_process === 2
                    ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 hover:border-green-300 cursor-pointer"
                    : "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-60"
                    }`}
                  title={props.vehicle.match_process !== 2 ? "ต้องรอ PDI Assembly เสร็จก่อนถึงจะทำ QC ได้" : ""}
                >
                  {/* <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg> */}
                  {props.vehicle.match_process === 2 ? "เปิดใช้สัญญาณรถ" : props.vehicle.match_process === 3 ? "รอตรวจ QC" : "รอ PDI Assembly ประกอบรถ"}
                </button>
              )}
              {showCursor() && props.vehicle.match_process === 2 && (
                <div class="absolute inset-0 pointer-events-none z-50 flex items-center justify-center">
                  {/* Click Ripple Effect */}
                  <div class="absolute w-10 h-10 rounded-full bg-green-400 animate-click-ripple"></div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Image */}
        <div class="mt-4 text-center">
          <img
            src={props.vehicle.image || "/folklift-image-nobg.png"}
            alt={String(props.vehicle.product_name || props.vehicle.model)}
            class="w-[100px] h-[100px] object-contain mx-auto rounded-md"
            onError={(e) => (e.currentTarget.src = "/folklift-image-nobg.png")}
          />
        </div>

        {/* Serial Numbers */}
        <div class="mt-4 mb-3 space-y-2">
          <p class="text-base text-gray-600 flex justify-between border-b border-dashed border-gray-200 pb-1">
            <span>S/N กล่อง:</span>
            <span class="font-mono text-gray-800 font-medium">
              {props.vehicle.fleet_box?.serial_number || props.vehicle.box_serial_number || "-"}
            </span>
          </p>
          <p class="text-base text-gray-600 flex justify-between">
            <span>S/N รถ:</span>
            <span class="font-mono text-gray-800 font-medium">
              {props.vehicle.serial_number}
            </span>
          </p>
        </div>



        {/* Legacy Actions */}
        <div class="space-y-2 mt-auto pt-3 border-t border-gray-100">
          <div class="grid grid-cols-2 gap-2">
            <button
              onClick={() => sendCommandLegacy(true)}
              disabled={!isMqttConnected() || props.vehicle.match_process !== 2 && props.vehicle.match_process !== 3 && props.vehicle.match_process !== 4}
              class="group rounded-md border border-gray-200 hover:bg-green-50 hover:border-green-300 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed py-1.5"
            >
              <div class="flex items-center justify-center gap-1.5">
                <div class="text-green-600 group-hover:scale-110 transition-all duration-200">
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
                <span class="text-green-700 font-medium text-xs">
                  {t("activate_vehicle")}
                </span>
              </div>
            </button>

            <button
              onClick={() => sendCommandLegacy(false)}
              disabled={!isMqttConnected() || props.vehicle.match_process !== 2 && props.vehicle.match_process !== 3 && props.vehicle.match_process !== 4}
              class="group rounded-md border border-gray-200 hover:bg-red-50 hover:border-red-300 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed py-1.5"
            >
              <div class="flex items-center justify-center gap-1.5">
                <div class="text-red-600 group-hover:scale-110 transition-all duration-200">
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
                      d="M6 18L18 6M6 6l12 12"
                    ></path>
                  </svg>
                </div>
                <span class="text-red-600 font-medium text-xs">
                  {t("deactivate_vehicle")}
                </span>
              </div>
            </button>
          </div>

          <a
            href={`/history?search=${props.vehicle.serial_number}`}
            class="flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-md border border-gray-200 transition-all duration-200"
          >
            <svg
              class="w-3.5 h-3.5"
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
    </div >
  );
};

export default VehicleCardV2;
