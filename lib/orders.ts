import { supabase } from "./supabase";

export type OrderStatus =
  | "Nuevo"
  | "Confirmado"
  | "En preparación"
  | "En ruta"
  | "Llegada"
  | "Entregado";
export type PaymentStatus = "Pendiente" | "Cobrado" | "Parcial";

export type OrderItemInput = {
  product_id: number;
  product_name_snapshot: string;
  unit_snapshot: string;
  unit_price: number;
  line_total: number;
  quantity: number;
};

export type OrderInput = {
  customer_id: string;
  customer_name_snapshot: string;
  customer_phone_snapshot: string;
  address_snapshot: string;
  delivery_day: string;
  delivery_window: string;
  total: number;
  customer_notes?: string;
  items: OrderItemInput[];
};

export async function createOrder(input: OrderInput) {
  // 1. Obtener usuario actual
  const { data: authData, error: authError } = await supabase.auth.getSession();
  if (authError || !authData.session?.user) {
    throw new Error("Usuario no autenticado");
  }

  const userId = authData.session.user.id;

  // 2. Insertar orden
  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .insert([
      {
        customer_id: input.customer_id,
        customer_name_snapshot: input.customer_name_snapshot,
        customer_phone_snapshot: input.customer_phone_snapshot,
        address_snapshot: input.address_snapshot,
        delivery_day: input.delivery_day,
        delivery_window: input.delivery_window,
        total: input.total,
        customer_notes: input.customer_notes || null,
        order_status: "Nuevo",
        payment_status: "Pendiente",
      },
    ])
    .select("id")
    .single();

  if (orderError || !orderData) {
    throw new Error(`Error creando pedido: ${orderError?.message}`);
  }

  // 3. Insertar items
  const itemsToInsert = input.items.map((item) => ({
    order_id: orderData.id,
    product_id: item.product_id,
    product_name_snapshot: item.product_name_snapshot,
    unit_snapshot: item.unit_snapshot,
    unit_price: item.unit_price,
    line_total: item.line_total,
    quantity: item.quantity,
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(itemsToInsert);

  if (itemsError) {
    throw new Error(`Error guardando productos de pedido: ${itemsError.message}`);
  }

  return orderData;
}

export async function getAdminOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      delivery_day,
      delivery_window,
      order_status,
      payment_status,
      total,
      created_at,
      customer_name_snapshot,
      customer_phone_snapshot,
      address_snapshot,
      customer_notes,
      delivery_sequence,
      order_items (
        quantity,
        product_name_snapshot,
        unit_snapshot
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Error obteniendo pedidos: ${error.message}`);
  }

  return data;
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const { error } = await supabase
    .from("orders")
    .update({ order_status: status })
    .eq("id", orderId);

  if (error) {
    throw new Error(`Error actualizando estado del pedido: ${error.message}`);
  }
}

export async function updateOrderPaymentStatus(orderId: string, payment_status: PaymentStatus) {
  const { error } = await supabase
    .from("orders")
    .update({ payment_status })
    .eq("id", orderId);

  if (error) {
    throw new Error(`Error actualizando estado de pago: ${error.message}`);
  }
}

