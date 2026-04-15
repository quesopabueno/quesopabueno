"use client";

import { supabase } from "@/lib/supabase";
import { getAdminOrders, updateOrderStatus, updateOrderPaymentStatus, type OrderStatus, type PaymentStatus } from "@/lib/orders";
import { useEffect, useState, useMemo } from "react";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, Truck, CheckCircle2, DollarSign, MapPin } from "lucide-react";

type DeliveryOrder = {
  id: string;
  db_id: string;
  customerName: string;
  phone: string;
  address: string;
  zipCode: string;
  status: OrderStatus;
  payment: PaymentStatus;
  total: number;
  itemsCount: number;
  notes: string | null;
  delivery_sequence: number | null;
};

export default function DeliveryPortal() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [isDelivery, setIsDelivery] = useState(false);
  const [authError, setAuthError] = useState("");
  
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      await checkDeliveryRole(session);
      if (mounted) setLoading(false);
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      await checkDeliveryRole(session);
      if (mounted) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkDeliveryRole = async (session: Session | null) => {
    if (!session?.user) {
      setIsDelivery(false);
      return;
    }
    
    // Check delivery users
    const { data: deliveryData } = await supabase
      .from("delivery_users")
      .select("user_id")
      .eq("user_id", session.user.id);

    const isDeliveryUser = Array.isArray(deliveryData) && deliveryData.length > 0;
    
    // Check admin users (admins also get access to testing the delivery view)
    const { data: adminData } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", session.user.id);
      
    const isAdminUser = Array.isArray(adminData) && adminData.length > 0;

    if (isDeliveryUser || isAdminUser) {
      setIsDelivery(true);
      loadOrders();
    } else {
      setIsDelivery(false);
      setAuthError("No tienes permisos de repartidor. Pide a tu administrador que te dé de alta.");
    }
  };

  const loadOrders = async () => {
    try {
      const rawOrders = await getAdminOrders();
      const active = rawOrders.filter(o => o.order_status !== "Entregado" && o.delivery_sequence !== null);
      
      const mapped = active.map(o => {
        const oNum = String(o.order_number);
        return {
          id: oNum.startsWith("QPB") ? oNum : `QPB-${oNum}`,
          db_id: o.id,
          customerName: o.customer_name_snapshot || "Desconocido",
        phone: o.customer_phone_snapshot || "-",
        address: o.address_snapshot || "-",
        zipCode: "N/A", 
        status: o.order_status as OrderStatus,
        payment: o.payment_status as PaymentStatus,
        total: o.total,
        delivery_sequence: o.delivery_sequence,
        itemsCount: o.order_items.reduce((acc: number, item: any) => acc + item.quantity, 0),
        notes: "-"
      };
    });
      
      // Sort strictly by the mathematical order given by the router
      mapped.sort((a,b) => (a.delivery_sequence || 999) - (b.delivery_sequence || 999));
      
      setOrders(mapped);
    } catch(e) {
      console.error(e);
    }
  };

  const handleSignIn = async () => {
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError("Credenciales inválidas.");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const updateStatus = async (db_id: string, st: OrderStatus) => {
    try {
      await updateOrderStatus(db_id, st);
      setOrders(curr => curr.map(o => o.db_id === db_id ? { ...o, status: st } : o));
    } catch(e) { alert("Error actualizando status"); }
  };

  const updatePayment = async (db_id: string, p: PaymentStatus) => {
    try {
      await updateOrderPaymentStatus(db_id, p);
      setOrders(curr => curr.map(o => o.db_id === db_id ? { ...o, payment: p } : o));
    } catch(e) { alert("Error actualizando pago"); }
  };

  // Sort instead of grouping by zip code
  const routeGroups = useMemo(() => orders, [orders]);

  if (loading) return <div className="p-8 text-center bg-zinc-50 min-h-screen">Cargando...</div>;

  if (!isDelivery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
        <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-sm border border-zinc-200">
          <Truck className="w-12 h-12 mb-4 text-blue-600" />
          <h1 className="text-2xl font-bold mb-2">Portal Logístico</h1>
          <p className="text-zinc-500 mb-6 text-sm">Tu ruta diaria te espera.</p>
          
          <div className="space-y-4">
            <Input type="email" placeholder="Correo" value={email} onChange={e => setEmail(e.target.value)} className="rounded-2xl" />
            <Input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} className="rounded-2xl" />
            {authError && <p className="text-red-500 text-sm">{authError}</p>}
            <Button className="w-full rounded-2xl bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSignIn}>
              Comenzar Turno
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 pb-20">
      <div className="bg-blue-600 text-white p-4 pt-8 shadow-md sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h1 className="font-bold text-xl">Tu Ruta de Entrega</h1>
          <p className="text-sm text-blue-200">{orders.length} paradas asignadas</p>
        </div>
        <Button variant="ghost" size="sm" className="text-white hover:bg-blue-700 rounded-xl" onClick={handleSignOut}>
          Terminar Turno
        </Button>
      </div>

      <div className="p-4 space-y-6 max-w-md mx-auto">
        {orders.map((o, index) => (
          <div key={o.id} className="relative bg-white rounded-3xl p-5 pt-8 shadow-sm border-2 border-zinc-200 space-y-4 overflow-hidden">
            
            <div className={`absolute top-0 left-0 right-0 h-2 ${index === 0 ? 'bg-green-500' : 'bg-transparent'}`} />
            
            <div className="absolute top-0 right-0 bg-blue-600 text-white px-4 py-1.5 font-black text-xl rounded-bl-2xl shadow-sm">
              Parada #{o.delivery_sequence}
            </div>

            <div className="flex justify-between items-start mt-2">
              <div>
                <h3 className="font-bold text-xl">{o.customerName}</h3>
                <p className="text-sm text-zinc-500">{o.id}</p>
              </div>
              <div className="text-right pt-1">
                <p className="font-black text-xl text-green-600">${Number(o.total).toFixed(2)}</p>
                <p className="text-xs font-semibold text-zinc-500">{o.payment}</p>
              </div>
            </div>

            <div className="text-sm bg-blue-50/50 p-4 rounded-2xl text-zinc-800 border border-blue-100">
              <div className="flex justify-between items-center gap-3">
                <p className="font-medium">{o.address}</p>
                <a 
                  href={`https://maps.google.com/?q=${encodeURIComponent(o.address)}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="shrink-0 bg-blue-600 text-white p-3 rounded-xl text-xs font-bold shadow-md hover:bg-blue-700 hover:scale-105 transition-all"
                >
                  <MapPin className="w-5 h-5" />
                </a>
              </div>
              <p className="mt-2 font-medium">📞 <a href={`tel:${o.phone}`} className="text-blue-600 underline">{o.phone}</a></p>
            </div>
            
            <div className="text-sm flex items-center justify-center gap-2 text-zinc-600 font-bold py-2 bg-zinc-50 rounded-xl">
              <Package className="w-5 h-5" /> TIENES {o.itemsCount} PRODUCTOS
            </div>

            {/* Acciones Logísticas Rápidas */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-100">
              <Button 
                variant={o.status === 'En preparación' ? 'default' : 'outline'} 
                className={`rounded-2xl font-bold h-12 ${o.status === 'En preparación' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'text-zinc-600 hover:bg-zinc-50'}`}
                onClick={() => updateStatus(o.db_id, 'En preparación' as OrderStatus)}
              >
                Estoy Afuera
              </Button>
              <Button 
                variant={o.status === 'Entregado' ? 'default' : 'outline'} 
                className={`rounded-2xl font-bold h-12 ${o.status === 'Entregado' ? 'bg-green-600' : 'bg-black text-white hover:bg-zinc-800'}`}
                onClick={() => updateStatus(o.db_id, 'Entregado')}
              >
                <CheckCircle2 className="w-5 h-5 mr-2" /> Entregado
              </Button>
            </div>

            {o.payment !== 'Cobrado' && (
              <Button 
                className="w-full rounded-2xl h-12 border-2 border-red-200 text-red-700 bg-red-50 font-bold hover:bg-red-100 mt-2"
                onClick={() => updatePayment(o.db_id, 'Cobrado')}
              >
                <DollarSign className="w-5 h-5 mr-2" /> Confirmar Cobro del Cliente
              </Button>
            )}

          </div>
        ))}
        
        {orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
             <Truck className="w-16 h-16 mb-4 opacity-50" />
             <p className="font-bold text-lg">No tienes ruta activa</p>
             <p className="text-sm">Espera órdenes del despachador.</p>
          </div>
        )}
      </div>
    </div>
  );
}
