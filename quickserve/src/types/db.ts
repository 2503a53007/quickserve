// Hand-maintained row types mirroring supabase/migrations. Keep in sync with the SQL.
export type UserRole = 'customer' | 'provider' | 'company' | 'admin';
export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'suspended';
export type BookingStatus =
  | 'pending' | 'confirmed' | 'provider_assigned' | 'provider_travelling'
  | 'provider_arrived' | 'in_progress' | 'completed' | 'cancelled' | 'rejected';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
export type PaymentMethod = 'cash' | 'upi';
export type RefundStatus = 'requested' | 'under_review' | 'approved' | 'processing' | 'completed' | 'rejected';
export type OwnerKind = 'provider' | 'company';
export type NotificationType =
  | 'booking_confirmed' | 'provider_accepted' | 'provider_assigned' | 'provider_travelling'
  | 'provider_arriving' | 'provider_arrived' | 'service_started' | 'service_completed'
  | 'payment_received' | 'new_offer' | 'refund_update' | 'booking_cancelled' | 'service_otp'
  | 'extra_hours' | 'delay' | 'ticket_update' | 'verification' | 'booking_request' | 'general';

export interface UserRow {
  id: string; role: UserRole; full_name: string | null; mobile: string | null; email: string | null;
  avatar_url: string | null; is_active: boolean; profile_completed: boolean;
  signup_intent: 'customer' | 'provider' | 'company' | null; created_at: string;
}
export interface ServiceCategory {
  id: string; name: string; slug: string; description: string | null; icon: string;
  gradient_from: string; gradient_to: string; image_url: string | null;
  is_emergency: boolean; is_active: boolean; sort_order: number;
}
export interface Service {
  id: string; category_id: string; name: string; slug: string; description: string | null;
  default_first_hour_price: number; default_additional_hour_price: number; default_visiting_charge: number;
  is_emergency: boolean; is_active: boolean; sort_order: number;
}
export interface Address {
  id: string; user_id: string; label: 'Home' | 'Office' | 'Other'; line1: string; line2: string | null;
  landmark: string | null; city: string; state: string; pin_code: string;
  latitude: number | null; longitude: number | null; is_default: boolean;
}
export interface Coupon {
  id: string; code: string; title: string; description: string | null;
  coupon_type: 'general' | 'first_booking' | 'festival' | 'seasonal' | 'referral';
  discount_type: 'percentage' | 'fixed'; discount_value: number; min_order_amount: number;
  max_discount_amount: number | null; usage_limit: number | null; per_user_limit: number; usage_count: number;
  valid_from: string; valid_until: string; is_active: boolean; first_booking_only: boolean;
  applicable_category_ids: string[] | null; restricted_user_id: string | null;
}
export interface Booking {
  id: string; booking_code: string; customer_id: string; provider_id: string | null; company_id: string | null;
  service_id: string; category_id: string; status: BookingStatus; booking_mode: 'asap' | 'scheduled';
  scheduled_start: string; scheduled_end: string; estimated_hours: number; extra_hours_approved: number;
  actual_hours: number | null; billed_hours: number | null; issue_description: string | null;
  address_line: string; address_city: string; address_state: string | null; address_pin: string;
  address_lat: number | null; address_lng: number | null;
  first_hour_price: number; additional_hour_price: number; visiting_charge: number;
  gst_percent: number; commission_percent: number; coupon_code: string | null;
  estimated_base: number; estimated_discount: number; estimated_tax: number; estimated_total: number;
  material_cost: number; spare_parts_cost: number;
  final_base: number | null; final_discount: number | null; final_tax: number | null; final_total: number | null;
  commission_amount: number | null; provider_earning: number | null;
  eta_at: string | null; eta_latest_at: string | null; eta_distance_km: number | null;
  payment_method: PaymentMethod; payment_status: PaymentStatus;
  confirmed_at: string | null; assigned_at: string | null; travelling_at: string | null; arrived_at: string | null;
  started_at: string | null; completed_at: string | null; cancelled_at: string | null;
  cancellation_reason: string | null; cancellation_fee: number; rejection_reason: string | null;
  created_at: string; updated_at: string;
}
export interface Invoice {
  id: string; invoice_number: string; booking_id: string; customer_name: string | null; customer_mobile: string | null;
  customer_email: string | null; customer_address: string | null; provider_name: string | null; company_name: string | null;
  service_name: string; service_description: string | null; service_date: string; start_time: string; end_time: string;
  actual_hours: number; billed_hours: number; line_items: InvoiceLine[]; base_amount: number; material_cost: number;
  spare_parts_cost: number; visiting_charge: number; discount_amount: number; tax_percent: number; tax_amount: number;
  total_amount: number; payment_status: PaymentStatus; payment_method: PaymentMethod | null; created_at: string;
}
export interface InvoiceLine { label: string; quantity: number; rate: number; amount: number }
