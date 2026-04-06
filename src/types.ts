export interface User {
  id: number;
  name: string;
  email: string;
  role_id: number;
  firstname: string;
  lastname: string;
  titlename: string;
  token?: string;
}

export interface VehicleMatching {
  m_id: number;
  fp_id: number;
  fb_id: number;
  created_at: string;
  updated_at: string | null;
  created_by: number;
  updated_by: number | null;
  is_deleted: number;
  status_booking: number;
  quote_id: number;
  status_vehicle: number;
  stamp_time_free: string | null;
  model_type: string | null;
}

export interface FleetBox {
  fb_id: number;
  serial_number: string;
  status: number;
  created_at: string;
  updated_at: string | null;
  created_by: number;
  updated_by: number | null;
  box_id: number;
  is_deleted: number;
  location: number;
  cancel_remark: string | null;
}

export interface Vehicle {
  // Primary identifiers
  id?: number;
  fp_id: number;
  m_id: number;
  fb_id?: number;

  // Product info
  product_id: number;
  product_name: string;
  serial_number: string;
  model: number | string;
  model_code: number | string | null;
  product_image: string | null;
  match_process: number;

  // Status and location
  status: number | "active" | "inactive" | "maintenance";
  location: number;

  // Optional fields
  fleet_name: string | null;
  battery: string | null;
  charger: string | null;
  cancel_remark: string | null;
  image?: string;

  // Timestamps
  created_at: string;
  updated_at: string | null;
  created_by: number;
  updated_by: number | null;
  is_deleted: number;

  // Nested objects
  matching: VehicleMatching | null;
  fleet_box: FleetBox | null;

  // Computed/derived fields (for backward compatibility)
  box_serial_number?: string;
  battery_level?: number;
  last_maintenance?: string;
  fleet_product?: {
    fleet_name?: string;
    serial_number?: string;
    model_info?: {
      id: number;
      name: string;
      model_code: string;
    };
  };
}

export interface HistoryLog {
  id: number;
  user_id: number;
  fb_id: number | null;
  fp_id: number | null;
  action: string;
  details: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  user?: User;
}

export interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: Meta;
}

export interface AuthResponse {
  user: User;
  token: string;
}
