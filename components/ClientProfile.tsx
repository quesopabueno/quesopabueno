"use client";

import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

type ClientProfileRow = {
  id: string;
  auth_user_id: string | null;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  street_address: string | null;
  house_or_apt: string | null;
  zip_code: string | null;
  preferred_delivery_day: string | null;
  preferred_delivery_time: string | null;
  notes: string | null;
};

const deliveryDayOptions = ["Sábado", "Domingo"];

const deliveryTimeOptions = [
  "9:00 AM - 12:00 PM",
  "1:00 PM - 4:00 PM",
  "4:00 PM - 7:00 PM",
];

type ClientProfileProps = {
  onClose?: () => void;
};

export default function ClientProfile({ onClose }: ClientProfileProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [houseOrApt, setHouseOrApt] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [preferredDeliveryDay, setPreferredDeliveryDay] = useState("Sábado");
  const [preferredDeliveryTime, setPreferredDeliveryTime] = useState(
    "9:00 AM - 12:00 PM"
  );
  const [notes, setNotes] = useState("");

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function resetForm() {
    setCustomerId(null);
    setFullName("");
    setPhone("");
    setStreetAddress("");
    setHouseOrApt("");
    setZipCode("");
    setPreferredDeliveryDay("Sábado");
    setPreferredDeliveryTime("9:00 AM - 12:00 PM");
    setNotes("");
  }

  async function loadProfile() {
    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(
          `Supabase error: ${userError.message} | code: ${
            userError.code ?? "N/A"
          }`
        );
      }

      if (!user) {
        setIsLoggedIn(false);
        setEmail("");
        resetForm();
        return;
      }

      setIsLoggedIn(true);
      setEmail(user.email ?? "");

      const { data, error } = await supabase
        .from("customers")
        .select(
          "id, auth_user_id, email, full_name, phone, street_address, house_or_apt, zip_code, preferred_delivery_day, preferred_delivery_time, notes"
        )
        .eq("auth_user_id", user.id)
        .limit(1);

      if (error) {
        throw new Error(
          `Supabase error: ${error.message} | code: ${error.code ?? "N/A"}`
        );
      }

      const profile =
        Array.isArray(data) && data.length > 0
          ? (data[0] as ClientProfileRow)
          : null;

      if (!profile) {
        setCustomerId(null);
        setFullName(user.user_metadata?.full_name ?? "");
        setPhone("");
        setStreetAddress("");
        setHouseOrApt("");
        setZipCode("");
        setPreferredDeliveryDay("Sábado");
        setPreferredDeliveryTime("9:00 AM - 12:00 PM");
        setNotes("");
        return;
      }

      setCustomerId(profile.id);
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setStreetAddress(profile.street_address || "");
      setHouseOrApt(profile.house_or_apt || "");
      setZipCode(profile.zip_code || "");
      setPreferredDeliveryDay(profile.preferred_delivery_day || "Sábado");
      setPreferredDeliveryTime(
        profile.preferred_delivery_time || "9:00 AM - 12:00 PM"
      );
      setNotes(profile.notes || "");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo cargar el perfil.";

      console.error("Client profile load error:", message);
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  async function loadOrders(cId: string) {
    try {
      setOrdersLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select("order_number, order_status, total, created_at")
        .eq("customer_id", cId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setOrders(data);
      }
    } catch (err) {
      console.error("Error loading client orders:", err);
    } finally {
      setOrdersLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (customerId) {
      loadOrders(customerId);
    }
  }, [customerId]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (!houseOrApt.trim()) throw new Error("Debes proporcionar el número de casa o apartamento.");
      if (!notes.trim()) throw new Error("Por favor ingresa algunas indicaciones o notas para la entrega.");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("No hay sesión de cliente activa.");
      }

      if (customerId) {
        const { error } = await supabase
          .from("customers")
          .update({
            full_name: fullName,
            phone: phone || null,
            street_address: streetAddress || null,
            house_or_apt: houseOrApt || null,
            zip_code: zipCode || null,
            preferred_delivery_day: preferredDeliveryDay || null,
            preferred_delivery_time: preferredDeliveryTime || null,
            notes: notes || null,
          })
          .eq("id", customerId);

        if (error) {
          throw new Error(
            `Supabase error: ${error.message} | code: ${error.code ?? "N/A"}`
          );
        }
      } else {
        const { data, error } = await supabase
          .from("customers")
          .insert({
            auth_user_id: user.id,
            email: user.email ?? null,
            full_name: fullName,
            phone: phone || null,
            street_address: streetAddress || null,
            house_or_apt: houseOrApt || null,
            zip_code: zipCode || null,
            preferred_delivery_day: preferredDeliveryDay || null,
            preferred_delivery_time: preferredDeliveryTime || null,
            notes: notes || null,
          })
          .select("id")
          .single();

        if (error) {
          throw new Error(
            `Supabase error: ${error.message} | code: ${error.code ?? "N/A"}`
          );
        }

        setCustomerId(data.id);
      }

      setSuccessMessage("Perfil actualizado correctamente.");
      if (onClose) {
        setTimeout(() => onClose(), 1500);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el perfil.";

      console.error("Client profile update error:", message);
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-zinc-900">Mi perfil</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Cargando información del cliente...
        </p>
      </section>
    );
  }

  if (!isLoggedIn) {
    return (
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-zinc-900">Mi perfil</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Inicia sesión para ver y editar tus datos.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Mi perfil</h2>
          <p className="text-sm text-zinc-500">
            Cliente autenticado: {email || "sin correo"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 font-medium text-zinc-800 transition hover:bg-zinc-100"
            >
              Volver
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="md:col-span-2 xl:col-span-2">
            <label className="mb-2 block text-sm font-medium text-zinc-800">
              Nombre completo
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              required
            />
          </div>

          <div className="md:col-span-1 xl:col-span-1">
            <label className="mb-2 block text-sm font-medium text-zinc-800">
              Teléfono
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
          </div>

          <div className="md:col-span-1 xl:col-span-1">
            <label className="mb-2 block text-sm font-medium text-zinc-800">
              Código postal
            </label>
            <input
              type="text"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
          </div>

          <div className="md:col-span-2 xl:col-span-2">
            <label className="mb-2 block text-sm font-medium text-zinc-800">
              Dirección principal
            </label>
            <input
              type="text"
              value={streetAddress}
              onChange={(e) => setStreetAddress(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
          </div>

          <div className="md:col-span-1 xl:col-span-1">
            <label className="mb-2 block text-sm font-medium text-zinc-800">
              Casa / apto
            </label>
            <input
              type="text"
              value={houseOrApt}
              onChange={(e) => setHouseOrApt(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              required
            />
          </div>

          <div className="md:col-span-1 xl:col-span-1">
            <label className="mb-2 block text-sm font-medium text-zinc-800">
              Día de entrega
            </label>
            <select
              value={preferredDeliveryDay}
              onChange={(e) => setPreferredDeliveryDay(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            >
              {deliveryDayOptions.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 xl:col-span-2">
            <label className="mb-2 block text-sm font-medium text-zinc-800">
              Horario de entrega
            </label>
            <select
              value={preferredDeliveryTime}
              onChange={(e) => setPreferredDeliveryTime(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            >
              {deliveryTimeOptions.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 xl:col-span-4">
            <label className="mb-2 block text-sm font-medium text-zinc-800">
              Notas
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="min-h-[120px] w-full rounded-xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              required
            />
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {successMessage}
          </div>
        ) : null}

        <div className="flex items-center justify-end border-t border-zinc-200 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-black px-5 py-3 font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
        </div>
      </form>

      {/* HISTORIAL DE PEDIDOS */}
      <div className="mt-12 border-t border-zinc-200 pt-8">
        <h3 className="text-xl font-bold text-zinc-900 mb-4">Mis últimos pedidos</h3>
        {ordersLoading ? (
          <p className="text-sm text-zinc-400">Cargando historial...</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-zinc-500 italic text-center py-6 bg-zinc-50 rounded-2xl">Aún no has realizado pedidos.</p>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.order_number} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-zinc-100 bg-white hover:border-zinc-300 transition-all shadow-sm gap-4">
                <div className="space-y-1">
                  <p className="font-black text-zinc-900 text-lg">#QPB-{o.order_number}</p>
                  <p className="text-xs text-zinc-400">{new Date(o.created_at).toLocaleDateString()} · {new Date(o.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
                
                <div className="flex items-center gap-4">
                   <div className="text-right">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Estado</p>
                      <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
                        o.order_status === 'Nuevo' ? 'bg-yellow-100 text-yellow-900 border-yellow-300' :
                        o.order_status === 'Entregado' ? 'bg-green-100 text-green-900 border-green-300' :
                        'bg-blue-100 text-blue-900 border-blue-300'
                      }`}>
                        {o.order_status === 'Nuevo' ? 'Recibido' : o.order_status}
                      </span>
                   </div>
                   <div className="text-right border-l pl-4 border-zinc-100">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Total</p>
                      <p className="font-black text-zinc-900">${o.total}</p>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}