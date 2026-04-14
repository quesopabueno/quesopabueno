export type Category = "Quesos" | "Lácteos / cremas / suero" | "Promociones";

export type Unit = "lb" | "unidad";

export type Product = {
  id: number;
  name: string;
  category: Category;
  price: number;
  unit: Unit;
  available: boolean;
  image?: string;
};

export type Customer = {
  id: string;
  full_name: string;
  phone: string;
  address: string;
  preferred_delivery_day?: string | null;
  preferred_delivery_time?: string | null;
  created_at?: string;
};

export type Order = {
  id: string;
  customer_id: string;
  status: "pendiente" | "confirmado" | "en_ruta" | "entregado" | "cancelado";
  payment_status: "pendiente" | "cobrado";
  total_amount: number;
  delivery_day?: string | null;
  delivery_time?: string | null;
  notes?: string | null;
  created_at?: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: number;
  quantity: number;
  unit_price: number;
  line_total: number;
};