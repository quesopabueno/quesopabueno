"use client";

import { adminSupabase as supabase } from "@/lib/supabase";
import { getAdminOrders, updateOrderStatus, updateOrderPaymentStatus, type OrderStatus, type PaymentStatus } from "@/lib/orders";
import { sampleProducts as sampleProductsFromFile } from "@/lib/mock-data";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import CustomersSection from "@/components/CustomersSection";
import {
  Shield,
  ClipboardList,
  AlertCircle,
  Truck,
  BarChart3,
  Plus,
  Pencil,
  Trash2,
  MapPinned,
  Clock3,
  ArrowLeft,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const BRAND = {
  red: "#D84A2B",
  black: "#171717",
  soft: "#F6F1E7",
};

const BUSINESS = {
  adminEmail: "quesopabueno@gmail.com",
};

type Category = "Quesos" | "Lácteos / cremas / suero" | "Promociones";
type Unit = "lb" | "unidad";

type Product = {
  id: number;
  name: string;
  category: Category;
  price: number;
  unit: Unit;
  available: boolean;
};

type ProductRow = {
  id: number;
  category_id: number | null;
  name: string;
  slug: string | null;
  description: string | null;
  unit: string | null;
  price: number | null;
};

type ProductDraft = {
  name: string;
  category: Category;
  price: string;
  unit: Unit;
};

type Order = {
  id: string;
  db_id: string;
  createdAt: string;
  customerName: string;
  phone: string;
  address: string;
  deliveryDay: string;
  deliveryWindow: string;
  status: OrderStatus;
  payment: PaymentStatus;
  total: number;
  items: { name: string; qty: number; unit: Unit }[];
};

const CATEGORY_BY_ID: Record<number, Category> = {
  1: "Quesos",
  2: "Lácteos / cremas / suero",
  3: "Promociones",
};

const CATEGORY_TO_ID: Record<Category, number> = {
  Quesos: 1,
  "Lácteos / cremas / suero": 2,
  Promociones: 3,
};

function mapDbUnit(unit: string | null): Unit {
  return unit === "lb" ? "lb" : "unidad";
}

function mapDbProductToUiProduct(row: ProductRow): Product {
  const category = CATEGORY_BY_ID[row.category_id ?? 1] ?? "Quesos";

  return {
    id: row.id,
    name: row.name,
    category,
    price: Number(row.price ?? 0),
    unit: mapDbUnit(row.unit),
    available: true,
  };
}

function buildSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function statusBadgeClass(status: OrderStatus | PaymentStatus) {
  switch (status) {
    case "Nuevo":
    case "Pendiente":
      return "bg-yellow-100 text-yellow-900 border-yellow-300";
    case "Confirmado":
    case "Parcial":
    case "En preparación":
      return "bg-orange-100 text-orange-900 border-orange-300";
    case "En ruta":
      return "bg-blue-100 text-blue-900 border-blue-300";
    case "Entregado":
    case "Cobrado":
      return "bg-green-100 text-green-900 border-green-300";
    default:
      return "bg-zinc-100 text-zinc-900 border-zinc-300";
  }
}

export default function AdminPage() {
  const [products, setProducts] = useState<Product[]>(sampleProductsFromFile);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [adminEmail, setAdminEmail] = useState(BUSINESS.adminEmail);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminSession, setAdminSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [adminActionError, setAdminActionError] = useState<string | null>(null);

  const [savingProduct, setSavingProduct] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<number | null>(null);

  const [adminDraft, setAdminDraft] = useState<ProductDraft>({
    name: "",
    category: "Quesos",
    price: "",
    unit: "lb",
  });

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editDraft, setEditDraft] = useState<ProductDraft>({
    name: "",
    category: "Quesos",
    price: "",
    unit: "lb",
  });

  const [driverDraftEmail, setDriverDraftEmail] = useState("");
  const [driverDraftPwd, setDriverDraftPwd] = useState("");
  const [creatingDriver, setCreatingDriver] = useState(false);
  const [driverMsg, setDriverMsg] = useState("");

  const loadProductsFromSupabase = async () => {
    setDbLoading(true);
    setDbError(null);

    const { data, error } = await supabase
      .from("products")
      .select("id, category_id, name, slug, description, unit, price")
      .order("category_id", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      setDbError(error.message);
      setProducts(sampleProductsFromFile);
      setDbLoading(false);
      return;
    }

    const mappedProducts = (data ?? []).map((row) => mapDbProductToUiProduct(row as ProductRow));
    setProducts(mappedProducts.length > 0 ? mappedProducts : sampleProductsFromFile);
    setDbLoading(false);
  };

  const loadAdminOrders = async () => {
    setOrdersLoading(true);
    try {
      const data = await getAdminOrders();
      const mappedOrders: Order[] = data.map((o: any) => {
        const oNum = String(o.order_number);
        return {
          id: oNum.startsWith("QPB") ? oNum : `QPB-${oNum}`,
          db_id: o.id,
          createdAt: o.created_at ? new Date(o.created_at).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '',
          customerName: o.customer_name_snapshot || "Desconocido",
          phone: o.customer_phone_snapshot || "-",
          address: o.address_snapshot || "-",
          deliveryDay: o.delivery_day,
          deliveryWindow: o.delivery_window,
          status: o.order_status,
          payment: o.payment_status,
          total: o.total,
          items: o.order_items.map((i: any) => ({
            name: i.product_name_snapshot || "Producto",
            qty: i.quantity,
            unit: i.unit_snapshot || "u",
          })),
        };
      });
      setOrders(mappedOrders);
    } catch (e: any) {
      setAdminActionError(e.message);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleStatusChange = async (db_id: string, newStatus: OrderStatus) => {
      try {
          await updateOrderStatus(db_id, newStatus);
          setOrders(curr => curr.map(o => o.db_id === db_id ? { ...o, status: newStatus } : o));
      } catch(e: any) { alert(e.message); }
  }

  const handlePaymentChange = async (db_id: string, newPay: PaymentStatus) => {
      try {
          await updateOrderPaymentStatus(db_id, newPay);
          setOrders(curr => curr.map(o => o.db_id === db_id ? { ...o, payment: newPay } : o));
      } catch(e: any) { alert(e.message); }
  }

  const resolveAdminState = async (session: Session | null) => {
    if (!session?.user) {
      setAdminSession(null);
      setIsAdmin(false);
      return;
    }

    const { data, error } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", session.user.id);

    if (error) {
      setAdminSession(null);
      setIsAdmin(false);
      return;
    }

    const adminMatch = Array.isArray(data) && data.length > 0;
    setAdminSession(adminMatch ? session : null);
    setIsAdmin(adminMatch);
    if (adminMatch) {
      loadAdminOrders();
    }
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      await loadProductsFromSupabase();
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      await resolveAdminState(data.session ?? null);
      if (!mounted) return;
      setAuthLoading(false);
    };

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      await resolveAdminState(session);
      if (!mounted) return;
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const adminSignedIn = Boolean(isAdmin && adminSession?.user);
  const weeklyOrders = useMemo(() => orders.length, [orders]);
  const pendingOrders = useMemo(() => orders.filter((o) => o.payment === "Pendiente").length, [orders]);
  const routeStops = useMemo(() => orders.filter((o) => o.status !== "Entregado").length, [orders]);
  const grossSales = useMemo(() => orders.reduce((sum, order) => sum + order.total, 0), [orders]);

  const adminSignIn = async () => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: adminEmail.trim(),
      password: adminPassword,
    });

    if (error) {
      setAuthError(error.message);
      return;
    }

    setAdminPassword("");
  };

  const adminSignOut = async () => {
    await supabase.auth.signOut();
    setAdminSession(null);
    setIsAdmin(false);
    setAdminPassword("");
    setAuthError(null);
    setAdminActionError(null);
  };

  const createProduct = async () => {
    if (!adminDraft.name.trim() || !adminDraft.price) return;
    if (!adminSignedIn) {
      setAdminActionError("Debes iniciar sesión como administrador para guardar productos.");
      return;
    }

    setSavingProduct(true);
    setAdminActionError(null);

    try {
      const name = adminDraft.name.trim();
      const slug = buildSlug(name);

      const { error } = await supabase.from("products").insert({
        category_id: CATEGORY_TO_ID[adminDraft.category],
        name,
        slug,
        description: null,
        unit: adminDraft.unit,
        price: Number(adminDraft.price),
      });

      if (error) {
        setAdminActionError(error.message);
        return;
      }

      setAdminDraft({ name: "", category: "Quesos", price: "", unit: "lb" });
      await loadProductsFromSupabase();
    } catch (e: any) {
      setAdminActionError(`Error de ejecución: ${e.message}`);
    } finally {
      setSavingProduct(false);
    }
  };

  const createDeliveryUser = async () => {
    if (!driverDraftEmail.trim() || !driverDraftPwd.trim()) return;
    setCreatingDriver(true);
    setDriverMsg("");

    try {
      const tempSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );

      const { data, error } = await tempSupabase.auth.signUp({
        email: driverDraftEmail.trim(),
        password: driverDraftPwd,
      });

      if (error) throw new Error(error.message);
      if (!data.user) throw new Error("No se pudo crear el usuario Auth.");

      const { error: insertError } = await supabase.from("delivery_users").insert({
        user_id: data.user.id,
      });

      if (insertError) throw new Error("Error insertando rol: " + insertError.message);

      setDriverMsg("✅ Repartidor creado y autorizado exitosamente.");
      setDriverDraftEmail("");
      setDriverDraftPwd("");
    } catch (e: any) {
      setDriverMsg("❌ Error: " + e.message);
    } finally {
      setCreatingDriver(false);
    }
  };

  const openEditDialog = (product: Product) => {
    setAdminActionError(null);
    setEditingProduct(product);
    setEditDraft({
      name: product.name,
      category: product.category,
      price: String(product.price),
      unit: product.unit,
    });
  };

  const updateProduct = async () => {
    if (!editingProduct) return;
    if (!editDraft.name.trim() || !editDraft.price) return;
    if (!adminSignedIn) {
      setAdminActionError("Debes iniciar sesión como administrador para editar productos.");
      return;
    }

    setSavingEdit(true);
    setAdminActionError(null);

    try {
      const name = editDraft.name.trim();
      const slug = buildSlug(name);

      const { error } = await supabase
        .from("products")
        .update({
          category_id: CATEGORY_TO_ID[editDraft.category],
          name,
          slug,
          unit: editDraft.unit,
          price: Number(editDraft.price),
        })
        .eq("id", editingProduct.id);

      if (error) {
        setAdminActionError(error.message);
        return;
      }

      await loadProductsFromSupabase();
      setEditingProduct(null);
    } catch (e: any) {
      setAdminActionError(`Error de ejecución: ${e.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteProduct = async (product: Product) => {
    if (!adminSignedIn) {
      setAdminActionError("Debes iniciar sesión como administrador para eliminar productos.");
      return;
    }

    const confirmed = window.confirm(`¿Eliminar "${product.name}"? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    setDeletingProductId(product.id);
    setAdminActionError(null);

    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) {
      setAdminActionError(error.message);
      setDeletingProductId(null);
      return;
    }

    if (editingProduct?.id === product.id) {
      setEditingProduct(null);
    }

    await loadProductsFromSupabase();
    setDeletingProductId(null);
  };

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_#fffdf8,_#f7f1e6_45%,_#efe7da_100%)] text-zinc-900">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">Queso Pa'Bueno</p>
            <h1 className="text-3xl font-black tracking-tight">Panel administrativo</h1>
          </div>
          <Button asChild variant="outline" className="rounded-2xl">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a tienda
            </Link>
          </Button>
        </div>

        <div className="mb-6 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <AdminSummaryCard title="Pedidos esta semana" value={String(weeklyOrders)} icon={<ClipboardList className="h-5 w-5" />} />
          <AdminSummaryCard title="Pendientes de cobro" value={String(pendingOrders)} icon={<AlertCircle className="h-5 w-5" />} />
          <AdminSummaryCard title="Entregas activas" value={String(routeStops)} icon={<Truck className="h-5 w-5" />} />
          <AdminSummaryCard title="Venta acumulada demo" value={money(grossSales)} icon={<BarChart3 className="h-5 w-5" />} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          {authLoading ? (
            <Card className="rounded-[28px] border-zinc-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5" />
                  Verificando sesión admin
                </CardTitle>
                <CardDescription>Esperando la sesión guardada del administrador.</CardDescription>
              </CardHeader>
            </Card>
          ) : adminSignedIn ? (
            <Card className="rounded-[28px] border-zinc-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Plus className="h-5 w-5" />
                  Gestión de productos
                </CardTitle>
                <CardDescription>
                  Esta sesión de administrador está separada de la sesión del cliente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                  Sesión admin activa: {adminSession?.user?.email}
                </div>

                {adminActionError ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {adminActionError}
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Nombre del producto</Label>
                    <Input
                      placeholder="Ejemplo: Mantequilla"
                      value={adminDraft.name}
                      onChange={(e) => setAdminDraft((d) => ({ ...d, name: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Categoría</Label>
                    <Select
                      value={adminDraft.category}
                      onValueChange={(v) => setAdminDraft((d) => ({ ...d, category: v as Category }))}
                    >
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Quesos">Quesos</SelectItem>
                        <SelectItem value="Lácteos / cremas / suero">Lácteos / cremas / suero</SelectItem>
                        <SelectItem value="Promociones">Promociones</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Precio</Label>
                    <Input
                      placeholder="0.00"
                      type="number"
                      value={adminDraft.price}
                      onChange={(e) => setAdminDraft((d) => ({ ...d, price: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Unidad</Label>
                    <Select
                      value={adminDraft.unit}
                      onValueChange={(v) => setAdminDraft((d) => ({ ...d, unit: v as Unit }))}
                    >
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lb">lb</SelectItem>
                        <SelectItem value="unidad">unidad</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2">
                    <Button
                      className="w-full rounded-2xl text-white"
                      style={{ backgroundColor: BRAND.red }}
                      onClick={createProduct}
                      disabled={savingProduct}
                    >
                      {savingProduct ? "Guardando..." : "Guardar producto"}
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" className="rounded-2xl" onClick={adminSignOut}>
                    Cerrar sesión admin
                  </Button>
                </div>

                <Separator />

                {dbLoading ? (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                    Cargando productos...
                  </div>
                ) : null}

                {dbError ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    No se pudo leer Supabase. Se está mostrando el catálogo local.
                  </div>
                ) : null}

                <div className="grid gap-3">
                  {products.map((product) => (
                    <div key={product.id} className="flex items-center justify-between rounded-2xl border border-zinc-200 p-4">
                      <div>
                        <p className="font-semibold text-zinc-900">{product.name}</p>
                        <p className="text-sm text-zinc-500">
                          {product.category} · {money(product.price)} / {product.unit}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge className="rounded-full border border-green-300 bg-green-100 text-green-800">
                          Disponible
                        </Badge>
                        <Button variant="outline" size="icon" className="rounded-2xl" onClick={() => openEditDialog(product)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="rounded-2xl text-red-600 hover:text-red-700"
                          onClick={() => deleteProduct(product)}
                          disabled={deletingProductId === product.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-[28px] border-zinc-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5" />
                  Acceso administrador
                </CardTitle>
                <CardDescription>
                  Este login va en una página separada y usa una sesión distinta a la del cliente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label>Correo</Label>
                  <Input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="quesopabueno@gmail.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Contraseña</Label>
                  <Input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Contraseña de Supabase Auth"
                  />
                </div>
                {authError ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {authError}
                  </div>
                ) : null}
                <Button className="w-full rounded-2xl text-white" style={{ backgroundColor: BRAND.red }} onClick={adminSignIn}>
                  Iniciar sesión admin
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-[28px] border-zinc-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-lg w-full">
                <span className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Pedidos y ruta de entrega</span>
                <Button asChild variant="outline" size="sm" className="rounded-2xl h-8">
                  <Link href="/admin/reportes">📄 Imprimir ticket</Link>
                </Button>
              </CardTitle>
              <CardDescription>Vista operativa inicial del panel administrativo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="rounded-3xl border border-zinc-200 p-4 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-zinc-900">{order.id} <span className="text-xs font-normal text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md ml-1">{order.createdAt}</span></p>
                        
                        <Select value={order.status} onValueChange={(v) => handleStatusChange(order.db_id, v as OrderStatus)}>
                          <SelectTrigger className={`h-7 rounded-full px-3 text-xs font-medium border ${statusBadgeClass(order.status)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Nuevo">Nuevo</SelectItem>
                            <SelectItem value="Confirmado">Confirmado</SelectItem>
                            <SelectItem value="En preparación">En preparación</SelectItem>
                            <SelectItem value="En ruta">En ruta</SelectItem>
                            <SelectItem value="Llegada">Llegada</SelectItem>
                            <SelectItem value="Entregado">Entregado</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <Select value={order.payment} onValueChange={(v) => handlePaymentChange(order.db_id, v as PaymentStatus)}>
                          <SelectTrigger className={`h-7 rounded-full px-3 text-xs font-medium border ${statusBadgeClass(order.payment)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pendiente">Pendiente</SelectItem>
                            <SelectItem value="Parcial">Parcial</SelectItem>
                            <SelectItem value="Cobrado">Cobrado</SelectItem>
                          </SelectContent>
                        </Select>

                      </div>
                      <p className="text-sm text-zinc-700">{order.customerName} · {order.phone}</p>
                      <div className="space-y-1 text-sm text-zinc-500">
                        <p className="flex items-center gap-2">
                          <MapPinned className="h-4 w-4" />
                          {order.address}
                        </p>
                        <p className="flex items-center gap-2">
                          <Clock3 className="h-4 w-4" />
                          {order.deliveryDay} · {order.deliveryWindow}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-zinc-500">Total</p>
                      <p className="text-xl font-bold text-zinc-900">{money(order.total)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {order.items.map((item, index) => (
                      <Badge key={`${item.name}-${index}`} variant="outline" className="rounded-full border-zinc-300 bg-zinc-50">
                        {item.qty} {item.unit} · {item.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {adminSignedIn ? (
          <section className="mt-6 space-y-6">
            <Card className="rounded-[28px] border-zinc-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Truck className="h-5 w-5" />
                  Alta de Repartidores
                </CardTitle>
                <CardDescription>
                  Crea nuevas cuentas para el portal móvil de logística e insértalas en la tabla `delivery_users`.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3 items-end">
                  <div className="grid gap-2">
                    <Label>Correo del chofer</Label>
                    <Input 
                      type="email" 
                      placeholder="chofer@queso.com"
                      value={driverDraftEmail}
                      onChange={e => setDriverDraftEmail(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Contraseña</Label>
                    <Input 
                      type="password" 
                      placeholder="Mínimo 6 caracteres"
                      value={driverDraftPwd}
                      onChange={e => setDriverDraftPwd(e.target.value)}
                    />
                  </div>
                  <div>
                    <Button 
                      className="w-full rounded-2xl bg-black text-white" 
                      onClick={createDeliveryUser}
                      disabled={creatingDriver}
                    >
                      {creatingDriver ? "Creando..." : "Crear acceso de entrega"}
                    </Button>
                  </div>
                </div>
                {driverMsg && (
                  <p className="mt-4 text-sm font-medium text-zinc-700">{driverMsg}</p>
                )}
              </CardContent>
            </Card>

            <CustomersSection />
          </section>
        ) : null}
      </div>

      <Dialog open={Boolean(editingProduct)} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="rounded-[28px] border-0 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar producto</DialogTitle>
            <DialogDescription>Actualiza nombre, categoría, precio y unidad.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nombre del producto</Label>
              <Input value={editDraft.name} onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))} />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Categoría</Label>
                <Select value={editDraft.category} onValueChange={(v) => setEditDraft((d) => ({ ...d, category: v as Category }))}>
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Quesos">Quesos</SelectItem>
                    <SelectItem value="Lácteos / cremas / suero">Lácteos / cremas / suero</SelectItem>
                    <SelectItem value="Promociones">Promociones</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Precio</Label>
                <Input type="number" value={editDraft.price} onChange={(e) => setEditDraft((d) => ({ ...d, price: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Unidad</Label>
              <Select value={editDraft.unit} onValueChange={(v) => setEditDraft((d) => ({ ...d, unit: v as Unit }))}>
                <SelectTrigger className="rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lb">lb</SelectItem>
                  <SelectItem value="unidad">unidad</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="rounded-2xl" onClick={() => setEditingProduct(null)} disabled={savingEdit}>
                Cancelar
              </Button>
              <Button className="rounded-2xl text-white" style={{ backgroundColor: BRAND.red }} onClick={updateProduct} disabled={savingEdit}>
                {savingEdit ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminSummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <Card className="rounded-[28px] border-zinc-200 bg-white shadow-sm">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-zinc-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900">{value}</p>
        </div>
        <div className="rounded-2xl p-3" style={{ backgroundColor: BRAND.soft }}>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
