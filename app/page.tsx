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

import { ShoppingCart, Package, User, MessageCircle, LogOut } from "lucide-react";
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
  deliveryDays: ["Sábado", "Domingo"],
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
  image_url: string | null;
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

const dayOptions = ["Sábado", "Domingo"];
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
    image: row.image_url || DEFAULT_PRODUCT_IMAGE,
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
  onUpdateQty,
  cartQty = 0,
  onNavigateToCheckout,
}: {
  product: Product;
  onAdd: (p: Product) => void;
  onUpdateQty: (id: number, delta: number) => void;
  cartQty?: number;
  onNavigateToCheckout?: () => void;
}) {
  const scrollToConfirm = () => {
    if (onNavigateToCheckout) onNavigateToCheckout();
    setTimeout(() => document.getElementById("confirm-order-btn")?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  };

  return (
    <div className="transition-transform duration-150 hover:-translate-y-1 h-full w-full">
      <Card className="overflow-hidden rounded-[24px] border-zinc-200 bg-white shadow-sm h-full flex flex-col relative group">
        <div className="aspect-[4/3] overflow-hidden bg-zinc-100 shrink-0 relative">
          <img
            src={product.image || DEFAULT_PRODUCT_IMAGE}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {product.promo ? (
            <div className="absolute top-2 right-2">
              <Badge className="rounded-full border-0 text-[11px] px-3 py-1 text-zinc-900 shadow-md font-bold tracking-wide uppercase" style={{ backgroundColor: BRAND.yellow }}>
                Promo
              </Badge>
            </div>
          ) : null}
        </div>
        <CardContent className="space-y-3 p-4 flex flex-col flex-1">
          <div className="flex-1">
            <h3 className="text-sm font-bold text-zinc-900 leading-tight line-clamp-2 min-h-[40px]">
              {product.name}
            </h3>
            <p className="text-xs font-medium text-zinc-500 mt-1 capitalize">Por {product.unit}</p>
          </div>

          <div className="flex flex-col gap-2 pt-2 mt-auto border-t border-zinc-100">
            <div className="flex items-center justify-between">
              <p className="text-lg font-black text-zinc-900 leading-none">
                {money(product.price)}
              </p>
            </div>
            {product.available ? (
              <div className="flex flex-col gap-1 mt-1">
                {cartQty === 0 ? (
                  <Button
                    className="w-full rounded-[16px] py-5 text-sm font-bold text-white shadow-sm transition-all hover:scale-[1.02]"
                    style={{ backgroundColor: BRAND.red }}
                    onClick={() => onAdd(product)}
                  >
                    AGREGAR
                  </Button>
                ) : (
                  <div className="flex flex-col gap-2 animate-in fade-in zoom-in duration-200">
                    <div className="flex items-center justify-between rounded-[16px] border border-zinc-200 bg-zinc-50 p-1 shadow-inner text-zinc-800">
                      <Button
                        variant="ghost"
                        onClick={() => onUpdateQty(product.id, -1)}
                        className="h-10 w-12 rounded-xl text-xl font-medium hover:bg-zinc-200 text-zinc-700"
                      >
                        -
                      </Button>
                      <span className="font-bold text-base w-8 text-center">{cartQty}</span>
                      <Button
                        variant="ghost"
                        onClick={() => onUpdateQty(product.id, 1)}
                        className="h-10 w-12 rounded-xl text-lg font-bold text-white shadow-sm hover:scale-105 transition-transform"
                        style={{ backgroundColor: BRAND.red }}
                      >
                        +
                      </Button>
                    </div>
                    <Button variant="outline" size="sm" onClick={scrollToConfirm} className="w-full text-[12px] h-auto py-2.5 mt-1 text-white hover:text-white bg-zinc-800 hover:bg-black transition-colors uppercase tracking-widest font-bold border-0 shadow-md">
                      Confirmar pedido
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <Badge variant="outline" className="w-full justify-center rounded-[16px] py-2.5 mt-1 text-sm border-zinc-300 text-zinc-500 font-medium">
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
  const [selectedDay, setSelectedDay] = useState("Sábado");
  const [selectedWindow, setSelectedWindow] = useState("9:00 AM - 12:00 PM");
  const [orders, setOrders] = useState<Order[]>([]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [orderSuccessMsg, setOrderSuccessMsg] = useState("");
  const [lastOrderNumber, setLastOrderNumber] = useState<number | null>(null);
  const [promoOpen, setPromoOpen] = useState(false);

  const resetAuthPanel = () => {
    setAuthTab("login");
    setAuthPanelKey((current) => current + 1);
  };

  const closeAuthPanel = () => {
    setAuthDialogOpen(false);
    resetAuthPanel();
    
    // Si hay cosas en el carrito, te llevo directo a pagar. Si no, al principio.
    if (cart.length > 0) {
      setTimeout(() => {
        document.getElementById("checkout-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 400);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
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
      .select("id, category_id, name, slug, description, unit, price, image_url")
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

  const regularProducts = useMemo(
    () => products.filter((p) => p.category !== "Promociones"),
    [products]
  );

  const promoProducts = useMemo(
    () => products.filter((p) => p.category === "Promociones"),
    [products]
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
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);
  };

  const openRegister = () => {
    setAuthTab("register");
    setAuthPanelKey((current) => current + 1);
    setAuthDialogOpen(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);
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

      if (profile.notes === "BLOQUEADO") {
        throw new Error("Tu cuenta tiene restricciones para realizar pedidos. Por favor contacta al administrador.");
      }

      const itemsInput = cart.map(item => ({
        product_id: item.id,
        product_name_snapshot: item.name,
        unit_snapshot: item.unit,
        unit_price: item.price,
        line_total: item.price * item.qty,
        quantity: item.qty
      }));

      const baseInput = {
        customer_name_snapshot: profile.full_name || "Cliente Sin Nombre",
        customer_phone_snapshot: profile.phone || "Sin Teléfono",
        address_snapshot: `${profile.street_address || ""} ${profile.house_or_apt || ""} - CP: ${profile.zip_code || ""}`.trim(),
        delivery_day: selectedDay,
        delivery_window: selectedWindow,
        total: cartTotal,
        customer_notes: [profile.notes, notes.trim()].filter(Boolean).join(" | ") || undefined,
        items: itemsInput,
      };

      let insertSuccess = false;
      let lastErr = null;

      const potentialIds = Array.from(new Set([profile.id, profile.auth_user_id, user!.id].filter(Boolean)));

      for (const cid of potentialIds) {
        try {
          await createOrder({ ...baseInput, customer_id: cid });
          insertSuccess = true;
          break;
        } catch (e: any) {
          lastErr = e;
        }
      }

      if (!insertSuccess) {
         throw lastErr || new Error("Error desconocido guardando pedido.");
      }

      setCart([]);
      setNotes("");
      setLastOrderNumber(orderData.order_number);
      setOrderSuccessMsg("¡Tu pedido fue recibido exitosamente!");
      setTimeout(() => {
        document.getElementById("checkout-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
      setTimeout(() => setOrderSuccessMsg(""), 4000);
    } catch (err: any) {
      alert("DEBUG (" + String(clientSession?.user?.id).substring(0, 5) + "): Hubo un error al procesar el pedido: " + err.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_#fffdf8,_#f7f1e6_45%,_#efe7da_100%)] text-zinc-900">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8 relative">
        {clientSignedIn && (
          <div className="absolute top-4 right-4 z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full bg-white/80 backdrop-blur-sm border-zinc-200 shadow-sm"
              onClick={() => setProfileOpen(true)}
            >
              <User className="mr-2 h-4 w-4" />
              Mi Perfil
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full h-9 px-4 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 bg-white/90 backdrop-blur-sm shadow-sm font-bold flex items-center gap-2"
              onClick={async () => {
                await supabase.auth.signOut();
                setProfileOpen(false);
              }}
            >
              <LogOut className="h-4 w-4" />
              Cerrar Sesión
            </Button>
          </div>
        )}
        <div className="mb-4" />

        {authDialogOpen && !clientSignedIn ? (
          <Card className="mb-6 rounded-[28px] border-zinc-200 bg-white shadow-xl relative overflow-hidden">
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
                  size="icon"
                  className="absolute top-4 right-4 h-10 w-10 rounded-full hover:bg-zinc-100 text-zinc-500"
                  onClick={() => {
                    closeAuthPanel();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  ✕
                </Button>
              </div>

              <Tabs
                key={authPanelKey}
                value={authTab}
                onValueChange={(value) =>
                  setAuthTab(value as "login" | "register")
                }
              >
                <TabsList className="mb-6 grid w-full grid-cols-2 rounded-2xl bg-zinc-200 p-1">
                  <TabsTrigger value="login" className="rounded-2xl text-zinc-600 data-[state=active]:bg-black data-[state=active]:text-white transition-all font-bold">
                    Ingresar
                  </TabsTrigger>
                  <TabsTrigger value="register" className="rounded-2xl text-zinc-600 data-[state=active]:bg-black data-[state=active]:text-white transition-all font-bold">
                    Regístrate
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
            <div 
              className="p-8 md:p-16 text-center flex flex-col items-center justify-center bg-zinc-100 rounded-t-[32px]" 
            >
              <div className="relative w-full max-w-2xl flex justify-center">
                <img 
                  src="/logo.png" 
                  alt="Queso Pa' Bueno Venezolano" 
                  className="w-full h-auto max-h-[300px] object-contain drop-shadow-xl hover:scale-105 transition-transform duration-300"
                />
              </div>
            </div>

            <div
              className="flex flex-col md:flex-row justify-center gap-4 p-6 md:p-8 w-full"
              style={{ backgroundColor: BRAND.black }}
            >
                {!clientSignedIn && (
                  <div 
                    className="rounded-2xl border flex-1 min-w-[200px] p-4 text-center text-zinc-100 shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-center gap-1 hover:scale-[1.02] hover:bg-zinc-700 bg-zinc-800 border-zinc-700"
                    onClick={() => openRegister()}
                  >
                    <p className="text-sm tracking-wide text-white/90">Regístrate o inicia sesión</p>
                    <p className="text-xl font-bold tracking-tight">Haz tu pedido</p>
                  </div>
                )}
              <MiniInfoCard
                title="Entregas"
                value="Sábado o Domingo"
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

                <div className="mt-6 grid gap-8 grid-cols-1 place-items-center">
                  {regularProducts.map((product) => (
                    <div key={product.id} className="w-full max-w-sm">
                      <ProductCard
                        product={product}
                        onAdd={addToCart}
                        onUpdateQty={updateQty}
                        cartQty={cart.find(c => c.id === product.id)?.qty}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div id="checkout-section" className="space-y-6 md:pb-0 pb-24 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:-mr-2 lg:pr-2 lg:pb-6" style={{ scrollbarWidth: "none" }}>
            <Card className="rounded-[28px] border-zinc-200 bg-white shadow-sm shrink-0">
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
                  <div className="rounded-[32px] bg-green-50 p-8 text-center text-green-700 border border-green-200 animate-in fade-in zoom-in duration-300">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                      <Package className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="font-black text-2xl mb-1">¡Listo!</h3>
                    <p className="text-sm font-medium mb-6 opacity-80">{orderSuccessMsg}</p>
                    
                    {lastOrderNumber && (
                      <div className="bg-white/50 rounded-2xl p-4 border border-green-100 mb-6">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Tu pedido es el</p>
                        <p className="text-2xl font-black text-zinc-900">#QPB-{lastOrderNumber}</p>
                      </div>
                    )}

                    <div className="space-y-3">
                      <Button 
                        className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold flex items-center justify-center gap-2"
                        onClick={() => {
                          const msg = encodeURIComponent(`Hola QPB, acabo de realizar el pedido #QPB-${lastOrderNumber}. ¿Podrían confirmarme la recepción?`);
                          window.open(`https://wa.me/${BUSINESS.phone.replace(/\s/g, '')}?text=${msg}`, '_blank');
                        }}
                      >
                        <MessageCircle className="w-5 h-5" />
                        Confirmar por WhatsApp
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-green-700 font-bold hover:bg-green-100/50" 
                        onClick={() => setOrderSuccessMsg("")}
                      >
                        Hacer otro pedido
                      </Button>
                    </div>
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
                  id="confirm-order-btn"
                  className="w-full rounded-2xl py-6 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundColor: BRAND.red }}
                  onClick={tryCheckout}
                  disabled={cart.length === 0 || checkoutLoading}
                >
                  {checkoutLoading ? "Procesando..." : "Confirmar pedido"}
                </Button>

                <p className="text-center text-xs text-zinc-500">
                  Pago contra pedido · entrega sábado o domingo
                </p>

                <a
                  href={`https://wa.me/1${BUSINESS.phone.replace(/\D/g, "")}?text=Hola Queso Pa Bueno, necesito ayuda con mi pedido.`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-4 text-sm font-semibold text-white shadow-lg transition-all hover:bg-[#128C7E] hover:scale-[1.02]"
                >
                  <MessageCircle className="h-5 w-5" />
                  Contáctanos por WhatsApp
                </a>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="rounded-[28px] border-0 p-0 sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="bg-white p-6 lg:p-8">
            <ClientProfile onClose={() => setProfileOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      {promoProducts.length > 0 && (
        <>
          <button
            onClick={() => setPromoOpen(true)}
            className="fixed bottom-6 right-6 lg:bottom-10 lg:right-10 z-40 animate-bounce shadow-[0_8px_30px_rgb(0,0,0,0.25)] rounded-full px-5 py-4 text-zinc-900 font-extrabold text-sm flex items-center gap-2 hover:scale-105 transition-transform"
            style={{ backgroundColor: BRAND.yellow }}
          >
            <span className="text-xl">🔥</span> PROMOCIONES
          </button>

          <Dialog open={promoOpen} onOpenChange={setPromoOpen}>
            <DialogContent className="rounded-[28px] border-0 p-0 sm:max-w-md max-h-[85vh] overflow-y-auto bg-white shadow-2xl">
              <div className="p-6 text-center shadow-sm" style={{ backgroundColor: BRAND.yellow }}>
                <h3 className="font-black text-black text-2xl tracking-tight">⭐ OFERTAS ⭐</h3>
                <p className="text-zinc-800 text-sm mt-1 font-medium">Lleva estos productos y aprovecha</p>
              </div>
              <div className="p-6 grid gap-6 grid-cols-1 place-items-center bg-zinc-50/50">
                {promoProducts.map((product) => (
                   <div key={product.id} className="w-full">
                     <ProductCard
                       product={product}
                       onAdd={addToCart}
                       onUpdateQty={updateQty}
                       cartQty={cart.find((c) => c.id === product.id)?.qty}
                       onNavigateToCheckout={() => setPromoOpen(false)}
                     />
                   </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

function MiniInfoCard({ title, value, href }: { title: string; value: string; href?: string }) {
  const content = (
    <div className={`rounded-2xl border p-4 text-center text-zinc-100 shadow-lg flex-1 min-w-[200px] transition-all duration-300 ${href ? 'bg-[#25D366] border-[#25D366] hover:bg-[#128C7E] hover:border-[#128C7E] hover:scale-[1.02] cursor-pointer' : 'bg-zinc-800 border-zinc-700'}`}>
      <p className={`text-sm tracking-wide ${href ? 'text-white font-semibold' : 'text-zinc-400'}`}>{title}</p>
      <p className={`mt-1 text-xl font-bold tracking-tight ${href ? 'text-white' : 'text-zinc-100'}`}>{value}</p>
    </div>
  );

  if (href) {
    return <a href={href} target="_blank" rel="noreferrer" className="block flex-1">{content}</a>;
  }
  return content;
}