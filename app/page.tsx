"use client";

import { supabase } from "@/lib/supabase";
import { sampleProducts as sampleProductsFromFile } from "@/lib/mock-data";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { createOrder } from "@/lib/orders";
import Link from "next/link";
import ClientRegisterForm from "@/components/ClientRegisterForm";
import ClientLoginForm from "@/components/ClientLoginForm";
import ClientProfile from "@/components/ClientProfile";

import { ShoppingCart, Package, User } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

const BRAND = {
  red: "#D84A2B",
  yellow: "#E7D02A",
  black: "#171717",
  cream: "#FFF9F0",
  soft: "#F6F1E7",
};

const BUSINESS = {
  name: "QUESO PA'BUENO",
  phone: "689 242 5868",
  deliveryDays: ["Viernes", "Sábado", "Domingo"],
};

type Category = "Quesos" | "Lácteos / cremas / suero" | "Promociones";
type Unit = "lb" | "unidad";
type OrderStatus =
  | "Nuevo"
  | "Confirmado"
  | "En preparación"
  | "En ruta"
  | "Entregado";
type PaymentStatus = "Pendiente" | "Cobrado" | "Parcial";

type Product = {
  id: number;
  name: string;
  category: Category;
  price: number;
  unit: Unit;
  available: boolean;
  promo?: string;
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
};

type CartItem = Product & { qty: number };

type Order = {
  id: string;
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

const DEFAULT_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1628088062854-d1870b4553da?q=80&w=1200&auto=format&fit=crop";

const CATEGORY_BY_ID: Record<number, Category> = {
  1: "Quesos",
  2: "Lácteos / cremas / suero",
  3: "Promociones",
};

const dayOptions = ["Viernes", "Sábado", "Domingo"];
const windowOptions = [
  "9:00 AM - 12:00 PM",
  "1:00 PM - 4:00 PM",
  "4:00 PM - 7:00 PM",
];

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
    promo: category === "Promociones" ? "Promo" : undefined,
    image: DEFAULT_PRODUCT_IMAGE,
  };
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="rounded-2xl p-3 shadow-sm"
        style={{ backgroundColor: BRAND.soft }}
      >
        {icon}
      </div>
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
          {title}
        </h2>
        <p className="text-sm text-zinc-600">{subtitle}</p>
      </div>
    </div>
  );
}

function ProductCard({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: (p: Product) => void;
}) {
  return (
    <div className="transition-transform duration-150 hover:-translate-y-1">
      <Card className="overflow-hidden rounded-3xl border-zinc-200 bg-white shadow-sm">
        <div className="aspect-[4/3] overflow-hidden bg-zinc-100">
          <img
            src={product.image || DEFAULT_PRODUCT_IMAGE}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        </div>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-zinc-900">
                {product.name}
              </h3>
              <p className="text-sm text-zinc-500">Venta por {product.unit}</p>
            </div>
            {product.promo ? (
              <Badge
                className="rounded-full border-0 text-zinc-900"
                style={{ backgroundColor: BRAND.yellow }}
              >
                Promo
              </Badge>
            ) : null}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-zinc-900">
                {money(product.price)}
              </p>
              <p className="text-xs text-zinc-500">/{product.unit}</p>
            </div>
            {product.available ? (
              <Button
                className="rounded-2xl text-white shadow-sm"
                style={{ backgroundColor: BRAND.red }}
                onClick={() => onAdd(product)}
              >
                Agregar
              </Button>
            ) : (
              <Badge
                variant="outline"
                className="rounded-full border-zinc-300 text-zinc-500"
              >
                Agotado
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Page() {
  const [category, setCategory] = useState<Category>("Quesos");
  const [products, setProducts] = useState<Product[]>(sampleProductsFromFile);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [clientSession, setClientSession] = useState<Session | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [authPanelKey, setAuthPanelKey] = useState(0);
  const [notes, setNotes] = useState("");
  const [selectedDay, setSelectedDay] = useState("Viernes");
  const [selectedWindow, setSelectedWindow] = useState("9:00 AM - 12:00 PM");
  const [orders, setOrders] = useState<Order[]>([]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [orderSuccessMsg, setOrderSuccessMsg] = useState("");

  const resetAuthPanel = () => {
    setAuthTab("login");
    setAuthPanelKey((current) => current + 1);
  };

  const closeAuthPanel = () => {
    setAuthDialogOpen(false);
    resetAuthPanel();
  };

  const switchAuthPanelToLogin = () => {
    setAuthTab("login");
    setAuthPanelKey((current) => current + 1);
  };

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

    const mappedProducts = (data ?? []).map((row) =>
      mapDbProductToUiProduct(row as ProductRow)
    );

    setProducts(
      mappedProducts.length > 0 ? mappedProducts : sampleProductsFromFile
    );
    setDbLoading(false);
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      await loadProductsFromSupabase();

      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        setClientSession(null);
        return;
      }

      setClientSession(data.session ?? null);
    };

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      setClientSession(session);

      if (session?.user) {
        closeAuthPanel();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const filteredProducts = useMemo(
    () => products.filter((p) => p.category === category),
    [products, category]
  );

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.qty, 0),
    [cart]
  );

  const clientSignedIn = Boolean(clientSession?.user);

  const addToCart = (product: Product) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);

      if (existing) {
        return current.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }

      return [...current, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id: number, delta: number) => {
    setCart((current) =>
      current
        .map((item) =>
          item.id === id
            ? { ...item, qty: Math.max(0, item.qty + delta) }
            : item
        )
        .filter((item) => item.qty > 0)
    );
  };

  const openLogin = () => {
    setAuthTab("login");
    setAuthPanelKey((current) => current + 1);
    setAuthDialogOpen(true);
  };

  const openRegister = () => {
    setAuthTab("register");
    setAuthPanelKey((current) => current + 1);
    setAuthDialogOpen(true);
  };

  const tryCheckout = async () => {
    if (cart.length === 0) return;

    if (!clientSignedIn) {
      openLogin();
      return;
    }

    try {
      setCheckoutLoading(true);
      const user = clientSession?.user;

      const { data: profileRow } = await supabase
        .from("customers")
        .select("*")
        .eq("auth_user_id", user?.id)
        .limit(1);

      const profile = Array.isArray(profileRow) && profileRow.length > 0 ? profileRow[0] : null;

      if (!profile) {
        throw new Error("Por favor completa tu perfil entrando a 'Mi perfil' antes de hacer un pedido.");
      }

      const itemsInput = cart.map(item => ({
        product_id: item.id,
        product_name_snapshot: item.name,
        unit_snapshot: item.unit,
        unit_price: item.price,
        line_total: item.price * item.qty,
        quantity: item.qty
      }));

      await createOrder({
        customer_id: user!.id,
        customer_name_snapshot: profile.full_name || "Cliente Sin Nombre",
        customer_phone_snapshot: profile.phone || "Sin Teléfono",
        address_snapshot: `${profile.street_address || ""} ${profile.house_or_apt || ""} - CP: ${profile.zip_code || ""}`.trim(),
        delivery_day: selectedDay,
        delivery_window: selectedWindow,
        total: cartTotal,
        customer_notes: [profile.notes, notes.trim()].filter(Boolean).join(" | ") || undefined,
        items: itemsInput,
      });

      setCart([]);
      setNotes("");
      setOrderSuccessMsg("¡Tu pedido fue confirmado exitosamente! Pago contra entrega.");
      setTimeout(() => setOrderSuccessMsg(""), 4000);
    } catch (err: any) {
      alert("Hubo un error al procesar el pedido: " + err.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_#fffdf8,_#f7f1e6_45%,_#efe7da_100%)] text-zinc-900">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className="rounded-full border-0 px-4 py-1 text-sm text-zinc-900"
              style={{ backgroundColor: BRAND.yellow }}
            >
              {BUSINESS.name}
            </Badge>

            {clientSignedIn ? (
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => setProfileOpen(true)}
              >
                <User className="mr-2 h-4 w-4" />
                Mi perfil
              </Button>
            ) : null}
          </div>

          {!clientSignedIn ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={openLogin}
              >
                Ingresar
              </Button>
              <Button
                className="rounded-2xl text-white"
                style={{ backgroundColor: BRAND.red }}
                onClick={openRegister}
              >
                Crear cliente
              </Button>
            </div>
          ) : null}
        </div>

        {authDialogOpen && !clientSignedIn ? (
          <Card className="mb-6 rounded-[28px] border-zinc-200 bg-white shadow-xl">
            <CardContent className="p-5 md:p-6">
              <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
                    {authTab === "login"
                      ? "Ingresa a tu cuenta"
                      : "Crea tu cuenta"}
                  </h2>
                  <p className="text-sm text-zinc-600">
                    Puedes revisar el catálogo sin iniciar sesión. Para
                    confirmar tu pedido, ingresa.
                  </p>
                </div>

                <Button
                  variant="ghost"
                  className="w-fit rounded-2xl text-zinc-500"
                  onClick={closeAuthPanel}
                >
                  Cerrar
                </Button>
              </div>

              <Tabs
                key={authPanelKey}
                value={authTab}
                onValueChange={(value) =>
                  setAuthTab(value as "login" | "register")
                }
              >
                <TabsList className="mb-6 grid w-full grid-cols-2 rounded-2xl bg-zinc-100 p-1">
                  <TabsTrigger value="login" className="rounded-2xl">
                    Ingresar
                  </TabsTrigger>
                  <TabsTrigger value="register" className="rounded-2xl">
                    Crear cliente
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="mt-0">
                  <ClientLoginForm onLoggedIn={closeAuthPanel} />
                </TabsContent>

                <TabsContent value="register" className="mt-0">
                  <ClientRegisterForm
                    onRegistered={closeAuthPanel}
                    onSwitchToLogin={switchAuthPanelToLogin}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ) : null}

        <Card className="mb-6 overflow-hidden rounded-[32px] border-0 shadow-2xl">
          <div className="flex flex-col">
            <div className="p-8 md:p-16 text-center flex flex-col items-center justify-center" style={{ backgroundColor: BRAND.cream }}>
              <h1 className="text-4xl font-black tracking-tight md:text-6xl uppercase drop-shadow-sm">
                <span className="text-[#FFCC00]">QUESO</span>{" "}
                <span className="text-[#005CE6]">Y LÁCTEOS</span>{" "}
                <span className="text-[#CF142B]">VENEZOLANOS</span>
              </h1>
            </div>

            <div
              className="flex flex-col md:flex-row justify-center gap-4 p-6 md:p-8 w-full"
              style={{ backgroundColor: BRAND.black }}
            >
              <MiniInfoCard 
                title="Contactanos whatsApp" 
                value={BUSINESS.phone} 
                href={`https://wa.me/1${BUSINESS.phone.replace(/\D/g, '')}?text=Hola Queso Pa Bueno`} 
              />
              <MiniInfoCard
                title="Entregas"
                value="Viernes - Sabado - Domingo"
              />
            </div>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1fr_370px]">
          <div className="space-y-6 md:pb-0 pb-24">
            <Card className="rounded-[28px] border-zinc-200 bg-white shadow-sm">
              <CardContent className="p-6 md:p-7">
                <SectionTitle
                  icon={<Package className="h-5 w-5 text-zinc-900" />}
                  title="Productos"
                  subtitle=""
                />



                {dbError ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Mostrando catálogo disponible en memoria local.
                  </div>
                ) : null}

                <Tabs
                  value={category}
                  onValueChange={(value) => setCategory(value as Category)}
                  className="mt-6"
                >
                  <TabsList className="grid w-full grid-cols-3 gap-2 bg-zinc-100 p-2 rounded-3xl h-auto">
                    <TabsTrigger 
                      value="Quesos" 
                      className="w-full rounded-2xl py-3 text-sm md:text-lg font-bold data-[state=active]:bg-[#D84A2B] data-[state=active]:text-white data-[state=active]:shadow-xl shadow-sm transition-all"
                    >
                      Quesos
                    </TabsTrigger>
                    <TabsTrigger
                      value="Lácteos / cremas / suero"
                      className="w-full rounded-2xl py-3 text-sm md:text-lg font-bold data-[state=active]:bg-[#D84A2B] data-[state=active]:text-white data-[state=active]:shadow-xl shadow-sm transition-all"
                    >
                      Lácteos y Suero
                    </TabsTrigger>
                    <TabsTrigger
                      value="Promociones"
                      className="w-full rounded-2xl py-3 text-sm md:text-lg font-bold data-[state=active]:bg-[#E7D02A] data-[state=active]:text-black data-[state=active]:shadow-xl shadow-sm transition-all"
                    >
                      Promociones
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value={category} className="mt-6">
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                      {filteredProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onAdd={addToCart}
                        />
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          <div id="checkout-section" className="space-y-6 md:pb-0 pb-24">
            <Card className="sticky top-6 rounded-[28px] border-zinc-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShoppingCart className="h-5 w-5" />
                  Carrito
                </CardTitle>
                <CardDescription>
                  Resumen del pedido del cliente.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
                {orderSuccessMsg ? (
                  <div className="rounded-2xl bg-green-50 p-6 text-center text-green-700 border border-green-200">
                    <p className="font-bold text-lg mb-1">¡Pedido Recibido!</p>
                    <p className="text-sm font-medium">{orderSuccessMsg}</p>
                  </div>
                ) : cart.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
                    No hay productos agregados todavía.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-zinc-200 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-zinc-900">
                              {item.name}
                            </p>
                            <p className="text-sm text-zinc-500">
                              {money(item.price)} / {item.unit}
                            </p>
                          </div>
                          <Badge variant="outline" className="rounded-full">
                            {item.qty}
                          </Badge>
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => updateQty(item.id, -1)}
                          >
                            -
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => updateQty(item.id, 1)}
                          >
                            +
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Separator />

                <div className="grid gap-2">
                  <Label>Notas del pedido</Label>
                  <Textarea
                    placeholder="Ejemplo: tocar al llegar, dejar en recepción, etc."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-[90px] rounded-2xl"
                  />
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Día de entrega</Label>
                    <Select value={selectedDay} onValueChange={setSelectedDay}>
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {dayOptions.map((day) => (
                          <SelectItem key={day} value={day}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Horario preferido</Label>
                    <Select
                      value={selectedWindow}
                      onValueChange={setSelectedWindow}
                    >
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {windowOptions.map((window) => (
                          <SelectItem key={window} value={window}>
                            {window}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex items-center justify-between text-sm text-zinc-600">
                    <span>Total estimado</span>
                    <span className="text-lg font-bold text-zinc-900">
                      {money(cartTotal)}
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full rounded-2xl py-6 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundColor: BRAND.red }}
                  onClick={tryCheckout}
                  disabled={cart.length === 0 || checkoutLoading}
                >
                  {checkoutLoading ? "Procesando..." : "Confirmar pedido"}
                </Button>

                <p className="text-center text-xs text-zinc-500">
                  Pago contra pedido · entrega viernes, sábado o domingo
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="rounded-[28px] border-0 p-0 sm:max-w-4xl">
          <div className="bg-white p-6 lg:p-8">
            <ClientProfile onClose={() => setProfileOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MiniInfoCard({ title, value, href }: { title: string; value: string; href?: string }) {
  const content = (
    <div className={`rounded-3xl border p-5 text-center text-white shadow-lg flex-1 min-w-[250px] transition-all duration-300 ${href ? 'bg-[#25D366] border-[#25D366] hover:bg-[#128C7E] hover:border-[#128C7E] hover:scale-[1.02] cursor-pointer' : 'border-white/10 bg-white/5'}`}>
      <p className={`text-sm tracking-wide ${href ? 'text-white font-semibold' : 'text-zinc-300'}`}>{title}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );

  if (href) {
    return <a href={href} target="_blank" rel="noreferrer" className="block flex-1">{content}</a>;
  }
  return content;
}