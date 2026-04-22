"use client";

import { supabase } from "@/lib/supabase";
import { getAdminOrders, updateOrderStatus, updateOrderPaymentStatus, type OrderStatus, type PaymentStatus } from "@/lib/orders";
import { sampleProducts as sampleProductsFromFile } from "@/lib/mock-data";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
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
  Users,
  Ban,
  Search,
  UserCheck,
  LogOut,
  ChevronDown,
  ChevronUp,
  Phone,
  User
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  image?: string;
};

type ProductRow = {
  id: number;
  category_id: number | null;
  name: string;
  slug: string | null;
  description: string | null;
  unit: string | null;
  price: number | null;
  image_url: string | null;
};

type ProductDraft = {
  name: string;
  category: Category;
  price: string;
  unit: Unit;
  file?: File | null;
};

type Order = {
  id: string;
  db_id: string;
  createdAt: string;
  customerName: string;
  customerStatus?: string | null;
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
    image: row.image_url || undefined,
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

  // Clientes State
  const [customers, setCustomers] = useState<any[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());

  const toggleOrder = (id: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCustomer = (id: string) => {
    setExpandedCustomers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [savingProduct, setSavingProduct] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<number | null>(null);

  const [adminDraft, setAdminDraft] = useState<ProductDraft>({
    name: "",
    category: "Quesos",
    price: "",
    unit: "lb",
    file: null,
  });

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editDraft, setEditDraft] = useState<ProductDraft>({
    name: "",
    category: "Quesos",
    price: "",
    unit: "lb",
    file: null,
  });

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
        return {
          id: `QPB-${o.order_number}`,
          db_id: o.id,
          customerName: o.customer_name_snapshot,
          customerStatus: o.customers?.notes || null,
          phone: o.customer_phone_snapshot,
          address: o.address_snapshot,
          deliveryDay: o.delivery_day,
          deliveryWindow: o.delivery_window,
          status: o.order_status,
          payment: o.payment_status,
          total: o.total,
          createdAt: new Date(o.created_at).toLocaleString('es-VE', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          items: (o.order_items || []).map((i: any) => ({
            name: i.product_name_snapshot,
            qty: i.quantity,
            unit: i.unit_snapshot
          }))
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
      loadAdminCustomers();
    }
  };

  const loadAdminCustomers = async () => {
    setCustomersLoading(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("full_name", { ascending: true });
      
      if (error) throw error;
      setCustomers(data || []);
    } catch (e: any) {
      console.error("Error loading customers:", e.message);
    } finally {
      setCustomersLoading(false);
    }
  };

  const updateCustomerTag = async (customerId: string, tag: string | null) => {
    try {
      const { error } = await supabase
        .from("customers")
        .update({ notes: tag }) // Usamos notes temporalmente como "etiqueta/alerta" si no hay campo dedicado
        .eq("id", customerId);
      
      if (error) throw error;
      setCustomers(curr => curr.map(c => c.id === customerId ? { ...c, notes: tag } : c));
    } catch (e: any) {
      alert("Error actualizando cliente: " + e.message);
    }
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      await loadProductsFromSupabase();
      
      const savedAdminEmail = localStorage.getItem("qpb_admin_email");
      if (savedAdminEmail) setAdminEmail(savedAdminEmail);

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

    localStorage.setItem("qpb_admin_email", adminEmail);
    setAdminPassword("");

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

  const uploadImageToSupabase = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, file);
    if (uploadError) throw new Error(`Error subiendo imagen: ${uploadError.message}`);
    const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
    return data.publicUrl;
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
      
      let image_url = null;
      if (adminDraft.file) {
        image_url = await uploadImageToSupabase(adminDraft.file);
      }

      const { error } = await supabase.from("products").insert({
        category_id: CATEGORY_TO_ID[adminDraft.category],
        name,
        slug,
        description: null,
        unit: adminDraft.unit,
        price: Number(adminDraft.price),
        image_url,
      });

      if (error) {
        setAdminActionError(error.message);
        return;
      }

      setAdminDraft({ name: "", category: "Quesos", price: "", unit: "lb", file: null });
      await loadProductsFromSupabase();
    } catch (e: any) {
      setAdminActionError(`Error de ejecución: ${e.message}`);
    } finally {
      setSavingProduct(false);
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

      let image_url = undefined;
      if (editDraft.file) {
        image_url = await uploadImageToSupabase(editDraft.file);
      }

      const { error } = await supabase
        .from("products")
        .update({
          category_id: CATEGORY_TO_ID[editDraft.category],
          name,
          slug,
          unit: editDraft.unit,
          price: Number(editDraft.price),
          ...(image_url ? { image_url } : {})
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
        <div className="mb-8 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">Queso Pa'Bueno</p>
            <h1 className="text-3xl font-black tracking-tight">Panel administrativo</h1>
          </div>
          {adminSignedIn && (
            <Button 
              variant="outline" 
              className="rounded-2xl border-red-200 text-red-600 font-bold hover:bg-red-50 hover:text-red-700 transition-colors gap-2 h-11 px-6 shadow-sm"
              onClick={adminSignOut}
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión admin
            </Button>
          )}
        </div>

        <div className="mb-6 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <AdminSummaryCard title="Pedidos esta semana" value={String(weeklyOrders)} icon={<ClipboardList className="h-5 w-5" />} />
          <AdminSummaryCard title="Pendientes de cobro" value={String(pendingOrders)} icon={<AlertCircle className="h-5 w-5" />} />
          <AdminSummaryCard title="Entregas activas" value={String(routeStops)} icon={<Truck className="h-5 w-5" />} />
          <AdminSummaryCard title="Venta acumulada demo" value={money(grossSales)} icon={<BarChart3 className="h-5 w-5" />} />
        </div>

        {!adminSignedIn ? (
           <div className="max-w-md mx-auto mt-12">
            <Card className="rounded-[28px] border-zinc-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Shield className="h-5 w-5" />
                    Acceso administrativo
                  </CardTitle>
                  <CardDescription>
                    Este login va en una página separada y usa una sesión distinta a la del cliente.
                  </CardDescription>
                </CardHeader>
                  <form onSubmit={(e) => { e.preventDefault(); adminSignIn(); }} className="space-y-4 px-6 pb-6">
                    <div className="grid gap-2">
                      <Label htmlFor="admin-email">Correo</Label>
                      <Input
                        id="admin-email"
                        type="email"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="quesopabueno@gmail.com"
                        autoComplete="username"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="admin-password">Contraseña</Label>
                      <Input
                        id="admin-password"
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Contraseña de Supabase Auth"
                        autoComplete="current-password"
                      />
                    </div>
                    {authError ? (
                      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {authError}
                      </div>
                    ) : null}
                    <Button type="submit" className="w-full rounded-2xl text-white" style={{ backgroundColor: BRAND.red }}>
                      Iniciar sesión admin
                    </Button>
                  </form>
              </Card>
           </div>
        ) : (
          <Tabs defaultValue="pedidos" className="w-full">
          <div className="flex justify-center mb-10">
            <TabsList className="h-20 inline-flex items-center rounded-[32px] bg-zinc-200/60 p-2 gap-3 border border-zinc-300/50 shadow-sm">
              <TabsTrigger value="pedidos" className="rounded-[24px] h-full px-8 data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:shadow-lg transition-all font-black text-base flex items-center gap-2">
                <ClipboardList className="w-5 h-5" /> Pedidos
              </TabsTrigger>
              <TabsTrigger value="productos" className="rounded-[24px] h-full px-8 data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:shadow-lg transition-all font-black text-base flex items-center gap-2">
                <Plus className="w-5 h-5" /> Productos
              </TabsTrigger>
              <TabsTrigger value="clientes" className="rounded-[24px] h-full px-8 data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:shadow-lg transition-all font-black text-base flex items-center gap-2">
                <Users className="w-5 h-5" /> Clientes
              </TabsTrigger>
              <TabsTrigger value="entregas" className="rounded-[24px] h-full px-8 data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:shadow-lg transition-all font-black text-base flex items-center gap-2">
                <Truck className="w-5 h-5" /> Entregas
              </TabsTrigger>
            </TabsList>
          </div>

            {/* TAB: PEDIDOS */}
            <TabsContent value="pedidos" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Card className="rounded-[28px] border-zinc-200 bg-white shadow-sm overflow-hidden">
                <CardHeader className="bg-zinc-50 border-b border-zinc-100">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <ClipboardList className="h-5 w-5 text-blue-600" /> Listado de Pedidos
                  </CardTitle>
                  <CardDescription>Gestiona los estados de envío y pago de cada orden.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 sm:p-6">
                  <div className="space-y-4 mt-4">
                    {ordersLoading ? (
                       <div className="text-center py-12 text-zinc-500">Cargando pedidos...</div>
                    ) : (
                      orders.map((order) => {
                        const isExpanded = expandedOrders.has(order.id);
                        return (
                          <div key={order.id} className="rounded-[22px] border border-zinc-200 shadow-sm hover:border-zinc-300 transition-all bg-white mx-4 sm:mx-0 overflow-hidden">
                            {/* COLLAPSED HEADER */}
                            <div 
                              className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between p-5 cursor-pointer hover:bg-zinc-50/50"
                              onClick={() => toggleOrder(order.id)}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                  <p className="text-lg font-black text-zinc-900">{order.id}</p>
                                  <Badge variant="secondary" className="rounded-md font-medium text-[10px] uppercase tracking-wider">{order.createdAt}</Badge>
                                  <div className={`h-2.5 w-2.5 rounded-full ${order.status === 'Entregado' ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
                                </div>
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-zinc-800">{order.customerName}</p>
                                  {order.customerStatus && (
                                    <Badge className={`text-[10px] py-0 h-5 font-black uppercase ${
                                      order.customerStatus === 'VIP' ? 'bg-amber-100 text-amber-900 border-amber-200' :
                                      order.customerStatus === 'NO PAGA' ? 'bg-red-600 text-white border-red-700' :
                                      order.customerStatus === 'BLOQUEADO' ? 'bg-black text-white' :
                                      'bg-zinc-100 text-zinc-600'
                                    }`}>
                                      {order.customerStatus}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-6">
                                <div className="text-right hidden sm:block">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Total</p>
                                  <p className="font-black text-zinc-900">{money(order.total)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                   <Badge className={`rounded-full px-3 text-[10px] h-6 font-bold border ${statusBadgeClass(order.status)}`}>
                                     {order.status}
                                   </Badge>
                                   {isExpanded ? <ChevronUp className="h-5 w-5 text-zinc-400" /> : <ChevronDown className="h-5 w-5 text-zinc-400" />}
                                </div>
                              </div>
                            </div>

                            {/* EXPANDED CONTENT */}
                            {isExpanded && (
                              <div className="p-5 border-t border-zinc-100 bg-zinc-50/30 animate-in slide-in-from-top-1 duration-200">
                                <div className="grid gap-6 md:grid-cols-2">
                                  <div className="space-y-4">
                                     <div className="flex flex-col gap-2">
                                       <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Acciones de Estado</p>
                                       <div className="flex flex-wrap gap-2">
                                         <Select value={order.status} onValueChange={(v) => handleStatusChange(order.db_id, v as OrderStatus)}>
                                           <SelectTrigger className={`h-9 rounded-xl px-4 text-xs font-bold border bg-white ${statusBadgeClass(order.status)}`}>
                                             <SelectValue />
                                           </SelectTrigger>
                                           <SelectContent>
                                             {["Nuevo", "Confirmado", "En preparación", "En ruta", "Llegada", "Entregado"].map(s => (
                                               <SelectItem key={s} value={s}>{s}</SelectItem>
                                             ))}
                                           </SelectContent>
                                         </Select>

                                         <Select value={order.payment} onValueChange={(v) => handlePaymentChange(order.db_id, v as PaymentStatus)}>
                                           <SelectTrigger className={`h-9 rounded-xl px-4 text-xs font-bold border bg-white ${statusBadgeClass(order.payment)}`}>
                                             <SelectValue />
                                           </SelectTrigger>
                                           <SelectContent>
                                             {["Pendiente", "Parcial", "Cobrado"].map(p => (
                                               <SelectItem key={p} value={p}>{p}</SelectItem>
                                             ))}
                                           </SelectContent>
                                         </Select>
                                       </div>
                                     </div>

                                     <div className="space-y-2 text-sm text-zinc-600 bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm">
                                       <p className="font-bold text-zinc-400 text-[10px] uppercase tracking-widest mb-1">Datos de Entrega</p>
                                       <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-zinc-400" /> {order.phone}</p>
                                       <p className="flex items-center gap-3"><MapPinned className="h-4 w-4 text-zinc-400" /> {order.address}</p>
                                       <p className="flex items-center gap-3"><Clock3 className="h-4 w-4 text-zinc-400" /> {order.deliveryDay} · {order.deliveryWindow}</p>
                                     </div>
                                  </div>

                                  <div className="space-y-3">
                                     <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Detalle de Productos</p>
                                     <div className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm space-y-2">
                                       {order.items.map((item, index) => (
                                         <div key={index} className="flex justify-between items-center text-sm border-b border-zinc-50 pb-2 last:border-0 last:pb-0">
                                           <span className="text-zinc-600">{item.name}</span>
                                           <span className="font-bold text-zinc-900">{item.qty} {item.unit}</span>
                                         </div>
                                       ))}
                                       <div className="pt-2 flex justify-between items-center">
                                         <span className="font-bold text-zinc-900">Total</span>
                                         <span className="text-lg font-black text-zinc-900">{money(order.total)}</span>
                                       </div>
                                     </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: PRODUCTOS */}
            <TabsContent value="productos" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
                <Card className="rounded-[28px] border-zinc-200 bg-white shadow-sm h-fit sticky top-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Plus className="h-5 w-5 text-red-600" /> Agregar Producto
                    </CardTitle>
                    <CardDescription>Crea un nuevo ítem en el menú.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {adminActionError && (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{adminActionError}</div>
                    )}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Nombre</Label>
                        <Input placeholder="Ej: Queso de Mano" value={adminDraft.name} onChange={(e) => setAdminDraft(d => ({ ...d, name: e.target.value }))} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Precio ($)</Label>
                          <Input type="number" value={adminDraft.price} onChange={(e) => setAdminDraft(d => ({ ...d, price: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Unidad</Label>
                          <Select value={adminDraft.unit} onValueChange={(v) => setAdminDraft(d => ({ ...d, unit: v as Unit }))}>
                            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="lb">lb</SelectItem><SelectItem value="unidad">unidad</SelectItem></SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Categoría</Label>
                        <Select value={adminDraft.category} onValueChange={(v) => setAdminDraft(d => ({ ...d, category: v as Category }))}>
                          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Quesos">Quesos</SelectItem>
                            <SelectItem value="Lácteos / cremas / suero">Lácteos / cremas / suero</SelectItem>
                            <SelectItem value="Promociones">Promociones</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Foto (Opcional)</Label>
                        <Input type="file" accept="image/*" onChange={(e) => setAdminDraft(d => ({ ...d, file: e.target.files?.[0] || null }))} className="cursor-pointer file:rounded-lg" />
                      </div>
                      <Button className="w-full rounded-xl text-white font-bold h-12" style={{ backgroundColor: BRAND.red }} onClick={createProduct} disabled={savingProduct}>
                        {savingProduct ? "Guardando..." : "Crear Producto"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-[28px] border-zinc-200 bg-white shadow-sm overflow-hidden">
                  <div className="grid gap-3 p-6 sm:grid-cols-2 2xl:grid-cols-3">
                    {dbLoading ? (
                      <div className="col-span-full py-12 text-center text-zinc-400">Cargando inventario...</div>
                    ) : products.map((product) => (
                      <div key={product.id} className="group relative rounded-2xl border border-zinc-100 p-4 hover:border-zinc-300 transition-all bg-zinc-50/30">
                        <div className="flex flex-col gap-3">
                          <div className="aspect-video w-full rounded-xl overflow-hidden bg-zinc-200">
                             <img src={product.image || 'https://via.placeholder.com/400x300'} className="w-full h-full object-cover" alt="" />
                          </div>
                          <div>
                            <h4 className="font-bold text-zinc-900 truncate">{product.name}</h4>
                            <p className="text-xs text-zinc-500 font-medium">{product.category} · {money(product.price)}/{product.unit}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Button variant="outline" size="sm" className="flex-1 rounded-xl h-9" onClick={() => openEditDialog(product)}><Pencil className="w-3 h-3 mr-2" /> Editar</Button>
                            <Button variant="outline" size="sm" className="rounded-xl h-9 text-red-600 hover:text-red-700" onClick={() => deleteProduct(product)}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </TabsContent>

            {/* TAB: CLIENTES */}
            <TabsContent value="clientes" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Card className="rounded-[28px] border-zinc-200 bg-white shadow-sm overflow-hidden">
                <CardHeader className="bg-zinc-50 border-b border-zinc-100">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <Users className="h-5 w-5 text-purple-600" /> Directorio de Clientes
                      </CardTitle>
                      <CardDescription>Identifica y gestiona el historial de tus compradores.</CardDescription>
                    </div>
                    <div className="relative max-w-sm w-full">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                      <Input 
                        placeholder="Buscar por nombre o teléfono..." 
                        className="pl-10 rounded-full bg-white"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-3">
                    {customersLoading ? (
                       <div className="text-center py-12 text-zinc-500">Cargando base de datos...</div>
                    ) : (
                      customers.filter(c => 
                        (c.full_name || "").toLowerCase().includes(customerSearch.toLowerCase()) || 
                        (c.phone || "").includes(customerSearch)
                      ).map((c) => {
                        const isExpanded = expandedCustomers.has(c.id);
                        return (
                          <div key={c.id} className="rounded-[22px] border border-zinc-200 shadow-sm bg-white overflow-hidden transition-all hover:border-zinc-300">
                             {/* COLLAPSED HEADER */}
                             <div 
                               className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-50/50"
                               onClick={() => toggleCustomer(c.id)}
                             >
                               <div className="flex items-center gap-3">
                                 <div className="rounded-full bg-zinc-100 p-2 text-zinc-400">
                                   <User className="h-5 w-5" />
                                 </div>
                                 <div>
                                   <p className="font-bold text-zinc-900">{c.full_name}</p>
                                   <p className="text-xs text-zinc-500">{c.phone}</p>
                                 </div>
                               </div>
                               
                               <div className="flex items-center gap-4">
                                  <div className="hidden sm:block">
                                    {c.notes === 'VIP' && <Badge className="bg-amber-100 text-amber-900 border-amber-200 font-bold uppercase text-[10px]">VIP ⭐</Badge>}
                                    {c.notes === 'BLOQUEADO' && <Badge className="bg-black text-white font-bold uppercase text-[10px]">Bloqueado 🚫</Badge>}
                                  </div>
                                  {isExpanded ? <ChevronUp className="h-5 w-5 text-zinc-400" /> : <ChevronDown className="h-5 w-5 text-zinc-400" />}
                               </div>
                             </div>

                             {/* EXPANDED CONTENT */}
                             {isExpanded && (
                               <div className="p-5 border-t border-zinc-100 bg-zinc-50/30 space-y-4 animate-in slide-in-from-top-1 duration-200">
                                 <div className="grid gap-6 md:grid-cols-2">
                                    <div className="space-y-4">
                                      <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Contacto</p>
                                        <p className="text-sm text-zinc-700 font-medium">{c.email || 'Sin correo'}</p>
                                        <p className="text-sm text-zinc-700">{c.phone}</p>
                                      </div>
                                      <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Ubicación</p>
                                        <p className="text-sm text-zinc-600">{c.street_address}, {c.house_or_apt}</p>
                                        <p className="text-[10px] font-bold text-zinc-400">CP: {c.zip_code}</p>
                                      </div>
                                    </div>

                                    <div className="space-y-2">
                                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Estado del Cliente</p>
                                      <Select value={c.notes || "Normal"} onValueChange={(v) => updateCustomerTag(c.id, v === "Normal" ? null : v)}>
                                        <SelectTrigger className={`h-10 rounded-xl px-4 text-xs font-bold border bg-white ${
                                          c.notes === 'VIP' ? 'bg-amber-100 border-amber-300 text-amber-900' :
                                          c.notes === 'NO PAGA' ? 'bg-red-100 border-red-300 text-red-900' :
                                          c.notes === 'NO RECIBE' ? 'bg-orange-100 border-orange-300 text-orange-900' :
                                          c.notes === 'BLOQUEADO' ? 'bg-black border-black text-white' :
                                          'bg-zinc-100 border-zinc-200 text-zinc-500'
                                        }`}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Normal">Estado Normal</SelectItem>
                                          <SelectItem value="VIP">Cliente VIP ⭐</SelectItem>
                                          <SelectItem value="NO PAGA">Pide y no paga ❌</SelectItem>
                                          <SelectItem value="NO RECIBE">No recibe / Cancela ⚠️</SelectItem>
                                          <SelectItem value="BLOQUEADO">BLOQUEADO 🚫</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      
                                      <div className="flex gap-2 mt-2">
                                        {c.notes === 'BLOQUEADO' && <span className="text-[10px] bg-black text-white px-2 py-0.5 rounded font-black">CUENTA BLOQUEADA</span>}
                                        {c.notes === 'NO PAGA' && <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded font-black animate-pulse">ALERTA MOROSO</span>}
                                      </div>
                                    </div>
                                 </div>
                               </div>
                             )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: ENTREGAS */}
            <TabsContent value="entregas" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
               <Card className="rounded-[28px] border-zinc-200 bg-white shadow-sm overflow-hidden p-12 text-center space-y-6">
                  <div className="mx-auto w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center">
                    <Truck className="w-10 h-10 text-blue-600" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black">Central de Logística y Tickets</h2>
                    <p className="text-zinc-500 max-w-md mx-auto">Desde aquí puedes organizar la ruta del chofer e imprimir los tickets de entrega para los paquetes.</p>
                  </div>
                  <Button asChild className="rounded-2xl h-14 px-8 text-lg font-bold shadow-xl shadow-blue-200" style={{ backgroundColor: BRAND.black }}>
                    <Link href="/admin/reportes">Abrir Generador de Ruta y Tickets →</Link>
                  </Button>
               </Card>
            </TabsContent>
          </Tabs>
        )}
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
            <div className="grid gap-2">
              <Label>Cambiar foto (Opcional)</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setEditDraft((d) => ({ ...d, file: e.target.files?.[0] || null }))}
                className="rounded-2xl cursor-pointer"
              />
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
