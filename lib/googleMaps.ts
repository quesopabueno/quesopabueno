"use server";

export type WaypointOrder = {
  id: string;
  address: string;
};

export async function optimizeRoute(origin: string, destination: string, orders: WaypointOrder[]) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("No hay API Key configurada para Google Maps en .env.local");
  }

  if (orders.length === 0) return [];
  if (orders.length > 25) {
    throw new Error("Google Maps permite un máximo de 25 paradas por cada cálculo de ruta.");
  }

  // Formato: optimize:true|dir1|dir2|dir3...
  const waypointsRaw = "optimize:true|" + orders.map(o => o.address).join("|");
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypointsRaw)}&key=${apiKey}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "OK") {
    let msg = data.status;
    if (data.status === "ZERO_RESULTS") msg = "No se encontró ruta terrestre entre estos puntos.";
    if (data.status === "NOT_FOUND") msg = "Una de las direcciones no existe o no se pudo decodificar.";
    if (data.error_message) msg += ` | Detalles: ${data.error_message}`;
    
    throw new Error(`Error de Google Maps: ${msg}`);
  }

  // waypoint_order es un arreglo de enteros que nos dice cómo ordenó Google nuestras entradas.
  // Por ejemplo si nosotros le dimos [Ped1, Ped2, Ped3] 
  // y Google devuelve [2, 0, 1] significa que la ruta óptima empieza yendo a Ped3 (indice 2 de nuestro array),
  // luego a Ped1 (indice 0), y finalmente a Ped2 (indice 1).
  const optimalOrder = data.routes[0].waypoint_order as number[];
  
  const sortedOrders = optimalOrder.map(index => orders[index]);
  
  return sortedOrders;
}
