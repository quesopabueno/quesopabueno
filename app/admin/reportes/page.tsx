"use client";

import { adminSupabase as supabase } from "@/lib/supabase";
import { getAdminOrders, type OrderStatus, type PaymentStatus } from "@/lib/orders";
import { optimizeRoute } from "@/lib/googleMaps";
import { useEffect, useState, useMemo, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Map as MapIcon, Truck, LocateFixed } from "lucide-react";

type PrintOrder = {
  id: string;
  db_id: string;
  customerName: string;
  phone: string;
  address: string;
  zipCode: string;
  deliveryWindow: string;
  payment: PaymentStatus;
  status: OrderStatus;
  total: number;
  items: { name: string; qty: number; unit: string }[];
  notes: string | null;
  delivery_sequence: number | null;
};

export default function ReportesPage() {
  const [orders, setOrders] = useState<PrintOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Dispatch State
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [dispatching, setDispatching] = useState(false);
  const [dispatchMsg, setDispatchMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [dispatchedRoute, setDispatchedRoute] = useState<PrintOrder[] | null>(null);

  const [mapsLoaded, setMapsLoaded] = useState(false);
  const originInputRef = useRef<HTMLInputElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!mapsLoaded || !(window as any).google) return;
    
    let originAutocomplete: any;
    let destAutocomplete: any;

    if (originInputRef.current) {
        originAutocomplete = new (window as any).google.maps.places.Autocomplete(originInputRef.current);
        originAutocomplete.addListener("place_changed", () => {
           const place = originAutocomplete.getPlace();
           if (place.formatted_address) setOrigin(place.formatted_address);
        });
    }
    
    if (destinationInputRef.current) {
        destAutocomplete = new (window as any).google.maps.places.Autocomplete(destinationInputRef.current);
        destAutocomplete.addListener("place_changed", () => {
           const place = destAutocomplete.getPlace();
           if (place.formatted_address) setDestination(place.formatted_address);
        });
    }
  }, [mapsLoaded]);

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Tu navegador no soporta GPS.");
      return;
    }
    setOrigin("Buscando señal GPS...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        if ((window as any).google) {
           const geocoder = new (window as any).google.maps.Geocoder();
           geocoder.geocode({ location: { lat, lng } }, (results: any, status: string) => {
             if (status === "OK" && results && results[0]) {
               setOrigin(results[0].formatted_address);
               if (originInputRef.current) originInputRef.current.value = results[0].formatted_address;
             } else {
               setOrigin(`${lat}, ${lng}`);
             }
           });
        } else {
           setOrigin(`${lat}, ${lng}`);
        }
      },
      (error) => {
        alert("Error obteniendo ubicación: " + error.message);
        setOrigin("");
      }
    );
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        
        const session = sessionData.session;
        if (!session?.user) {
          if (mounted) setLoading(false);
          return;
        }

        const { data: adminData } = await supabase
          .from("admin_users")
          .select("user_id")
          .eq("user_id", session.user.id);

        const isAdm = Array.isArray(adminData) && adminData.length > 0;
        if (mounted) setIsAdmin(isAdm);

        if (isAdm) {
            const rawOrders = await getAdminOrders();
            const activeOrders = rawOrders.filter(o => o.order_status !== "Entregado" && o.order_status !== "En ruta");
            
            if (mounted) {
              setOrders(activeOrders.map(o => ({
                id: `QPB-${o.order_number}`,
                db_id: o.id,
                customerName: o.customer_name_snapshot || "Desconocido",
                phone: o.customer_phone_snapshot || "-",
                address: o.address_snapshot || "-",
                zipCode: "N/A",
                deliveryWindow: `${o.delivery_day} · ${o.delivery_window}`,
                payment: o.payment_status as PaymentStatus,
                status: o.order_status as OrderStatus,
                notes: o.customer_notes || "-",
                total: o.total,
                delivery_sequence: o.delivery_sequence,
                items: (o.order_items || []).map((i: any) => ({
                  name: i.product_name_snapshot || "Producto",
                  qty: i.quantity,
                  unit: i.unit_snapshot || "u",
                })),
              })));
            }
        }
      } catch (e: any) {
        console.error("Error inicializando despachos:", e);
        if (mounted) alert("Ocurrió un error leyendo los datos iniciales: " + e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();
    return () => { mounted = false; };
  }, []);

  const toggleOrder = (id: string) => {
    const newSet = new Set(selectedOrderIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedOrderIds(newSet);
  };

  const handleDispatch = async () => {
    setErrorMsg("");
    setDispatchMsg("");
    if (selectedOrderIds.size === 0) {
      setErrorMsg("Selecciona al menos 1 pedido para despachar."); return;
    }
    if (!origin.trim() || !destination.trim()) {
      setErrorMsg("Llena el punto de partida y el punto final de la ruta."); return;
    }
    
    setDispatching(true);
    setDispatchMsg("Calculando ruta matemática óptima vía Google Maps...");
    
    try {
      const selectedArr = orders.filter(o => selectedOrderIds.has(o.db_id));
      
      const payload = selectedArr.map(o => ({
        id: o.db_id,
        address: o.address
      }));

      // Inicia cálculo de la ruta
      const sortedPayload = await optimizeRoute(origin, destination, payload);
      
      // Conecta a Supabase para clavar los valores de delivery_sequence
      setDispatchMsg("Guardando itinerario en la base de datos de los choferes...");

      const updatedOrders: PrintOrder[] = [];
      
      for (let i = 0; i < sortedPayload.length; i++) {
        const item = sortedPayload[i];
        
        const { error } = await supabase.from("orders")
            .update({ delivery_sequence: i + 1, order_status: "En ruta" })
            .eq("id", item.id);
            
        if (error) {
           throw new Error(`Error guardando db_id ${item.id}: ${error.message}`);
        }

        // Reconstruimos el array original pero ordenado matemáticamente
        const originalOrderMatch = selectedArr.find(x => x.db_id === item.id);
        if (originalOrderMatch) {
            updatedOrders.push({ ...originalOrderMatch, delivery_sequence: i + 1, status: "En ruta" });
        }
      }
      
      setDispatchMsg("¡Ruta despachada exitosamente! Generando PDF...");
      setDispatchedRoute(updatedOrders);
      
      setTimeout(() => {
        window.print();
        setDispatching(false);
      }, 1000);

    } catch(e: any) {
      setErrorMsg(e.message);
      setDispatching(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Cargando reporte...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-red-600">
        No tienes permisos para ver el reporte de entregas.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-black">
      <Script 
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
        strategy="lazyOnload"
        onLoad={() => setMapsLoaded(true)}
      />
      
      {/* ===== VISTA DE SELECCIÓN Y CONFIGURACIÓN DE RUTA ===== */}
      {!dispatchedRoute && (
        <div className="print:hidden mx-auto max-w-5xl p-6">
          <div className="mb-6 flex items-center justify-between border-b border-zinc-200 pb-4">
            <div>
              <h1 className="text-3xl font-black flex items-center gap-2"><MapIcon className="w-8 h-8"/> Central de Despacho</h1>
              <p className="text-zinc-500 text-sm mt-1">Selecciona los pedidos y crea la ruta óptima para el chofer.</p>
            </div>
            <Button asChild variant="outline" className="rounded-2xl">
              <Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" /> Volver al Admin</Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-xl font-bold bg-zinc-200 px-4 py-2 rounded-lg inline-block">Pedidos Listos para Despachar</h2>
              {orders.length === 0 ? (
                <p className="text-zinc-500">No hay órdenes pendientes en este momento.</p>
              ) : (
                <div className="grid gap-3">
                  {orders.map(o => {
                    const isSelected = selectedOrderIds.has(o.db_id);
                    return (
                      <div 
                        key={o.db_id} 
                        onClick={() => toggleOrder(o.db_id)}
                        className={`cursor-pointer border p-4 rounded-xl flex items-center gap-4 transition-all ${isSelected ? 'border-primary bg-primary/5 ring-2 ring-primary ring-offset-1' : 'border-zinc-300 bg-white hover:border-zinc-400'}`}
                      >
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-primary bg-primary' : 'border-zinc-300'}`}>
                          {isSelected && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center bg-">
                            <span className="font-bold text-lg">{o.id}</span>
                            <span className="text-xs uppercase font-semibold text-zinc-500">{o.deliveryWindow}</span>
                          </div>
                          <p className="font-semibold text-sm">{o.customerName}</p>
                          <p className="text-xs text-zinc-600 line-clamp-1 truncate block">{o.address}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="bg-white border text-sm border-zinc-200 shadow-sm rounded-2xl p-6 sticky top-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Truck className="w-5 h-5"/> Detalles de la Ruta</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-blue-600 mb-1 uppercase">1. Dirección de Origen (Punto de Salida)</label>
                    <div className="relative">
                      <input 
                        ref={originInputRef}
                        type="text" 
                        value={origin}
                        onChange={(e) => setOrigin(e.target.value)}
                        className="w-full border-2 border-blue-200 rounded p-3 pr-10 text-sm focus:ring-2 focus:ring-blue-600 outline-none"
                        placeholder="Ej: 123 Almacén St..."
                      />
                      <button 
                        onClick={handleCurrentLocation}
                        title="Usar mi ubicación actual"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <LocateFixed className="w-5 h-5"/>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-600 mb-1 uppercase">2. Dirección de Destino Final (Donde terminará su turno)</label>
                    <input 
                      ref={destinationInputRef}
                      type="text" 
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className="w-full border-2 border-blue-200 rounded p-3 text-sm focus:ring-2 focus:ring-blue-600 outline-none"
                      placeholder="Ej: Su Casa, 456 Main St..."
                    />
                  </div>
                  
                  <div className="bg-zinc-100 rounded-lg p-3 text-center border border-zinc-200">
                    <p className="text-2xl font-black">{selectedOrderIds.size}</p>
                    <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Paradas Seleccionadas</p>
                  </div>

                  {errorMsg && <p className="text-red-600 text-xs text-center border border-red-200 bg-red-50 p-2 rounded">{errorMsg}</p>}
                  {dispatchMsg && !errorMsg && <p className="text-blue-600 text-xs text-center border border-blue-200 bg-blue-50 p-2 rounded animate-pulse">{dispatchMsg}</p>}

                  <Button 
                    onClick={handleDispatch} 
                    disabled={dispatching || selectedOrderIds.size === 0}
                    className="w-full rounded-xl bg-black text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {dispatching ? "Procesando Algoritmo..." : "Generar Ruta y Despachar"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== VISTA DE IMPRESIÓN (SOLO APARECE DESPUÉS DEL DESPACHO O DURANTE EL PRINT) ===== */}
      {dispatchedRoute && (
        <div className="mx-auto max-w-5xl bg-white min-h-screen">
          <div className="print:hidden p-6 bg-zinc-900 text-white flex justify-between items-center">
            <p className="font-bold">¡Ruta Generada con Éxito!</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => window.print()} variant="secondary">Imprimir de Nuevo</Button>
              <Button size="sm" onClick={() => { setDispatchedRoute(null); setSelectedOrderIds(new Set()); window.location.reload(); }} variant="secondary">Hacer Otra Ruta</Button>
            </div>
          </div>
          
          <div className="p-8 print:p-0">
             <div className="border-b-2 border-black pb-1 mb-2">
                <h1 className="text-xl font-black uppercase tracking-tight">Manifiesto de Despacho de Ruta</h1>
                <p className="text-[11px] font-semibold text-zinc-600">Generado: {new Date().toLocaleDateString()} a las {new Date().toLocaleTimeString()} • Paradas Totales: {dispatchedRoute.length}</p>
             </div>

             <table className="w-full text-left text-[11px] border-collapse border border-zinc-400">
               <thead className="bg-zinc-100 print:bg-transparent">
                 <tr>
                   <th className="border border-zinc-400 px-1 py-1 w-8 text-center uppercase tracking-wider text-[9px] whitespace-nowrap">Parada</th>
                   <th className="border border-zinc-400 px-1 py-1 w-12 text-center uppercase tracking-wider text-[9px] whitespace-nowrap">ID/Hora</th>
                   <th className="border border-zinc-400 px-1 py-1 w-1/4 uppercase tracking-wider text-[9px]">Cliente / Teléfono</th>
                   <th className="border border-zinc-400 px-2 py-1 w-2/5 uppercase tracking-wider text-[9px]">Dirección Completa</th>
                   <th className="border border-zinc-400 px-1 py-1 uppercase tracking-wider text-[9px]">Productos a Entregar</th>
                   <th className="border border-zinc-400 px-1 py-1 w-16 text-right uppercase tracking-wider text-[9px] whitespace-nowrap">Total</th>
                 </tr>
               </thead>
               <tbody>
                 {dispatchedRoute.map((o) => (
                   <tr key={o.db_id} className="break-inside-avoid">
                     <td className="border border-zinc-400 px-1 py-1 align-top text-center">
                       <span className="font-black text-sm">#{o.delivery_sequence}</span>
                     </td>
                     <td className="border border-zinc-400 px-1 py-1 align-top text-center whitespace-nowrap">
                       <p className="font-bold text-[11px]">{o.id}</p>
                       <p className="text-[9px] font-semibold text-zinc-500 uppercase">{o.deliveryWindow}</p>
                     </td>
                     <td className="border border-zinc-400 px-1 py-1 align-top">
                       <p className="font-bold text-[11px] leading-tight">{o.customerName}</p>
                       <p className="text-[10px] font-medium leading-tight">📞 {o.phone}</p>
                     </td>
                     <td className="border border-zinc-400 px-2 py-1 align-top">
                       <p className="text-[11px] font-medium leading-tight">{o.address.replace(/(,\s*)?CP:\s*\d+/gi, '').replace(/(,\s*)?CP\s*\d+/gi, '')}</p>
                       {o.notes && <p className="text-[9px] italic text-zinc-600 mt-0.5 leading-tight">Nota: {o.notes}</p>}
                     </td>
                     <td className="border border-zinc-400 px-1 py-1 align-top">
                       <ul className="space-y-0.5">
                         {o.items.map((item, i) => (
                           <li key={i} className="text-[10px] leading-tight">
                             <span className="font-black">{item.qty}{item.unit}</span> - <span className="font-medium text-zinc-800">{item.name}</span>
                           </li>
                         ))}
                       </ul>
                     </td>
                     <td className="border border-zinc-400 px-1 py-1 align-top text-right">
                       <p className="font-black text-xs">${Number(o.total).toFixed(2)}</p>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white; }
          .print\\:hidden { display: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:border-transparent { border-color: transparent !important; }
          @page { margin: 0.5cm; }
        }
      `}} />
    </div>
  );
}
