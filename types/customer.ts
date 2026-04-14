export type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  street_address: string | null;
  house_or_apt: string | null;
  zip_code: string | null;
  preferred_delivery_day: string | null;
  preferred_delivery_time: string | null;
  notes: string | null;
  created_at?: string;
};