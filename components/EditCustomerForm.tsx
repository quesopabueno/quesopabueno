"use client";

import { useState } from "react";
import { updateCustomer } from "@/lib/customers";
import type { Customer } from "@/types/customer";

type EditCustomerFormProps = {
  customer: Customer;
  onCancel?: () => void;
  onUpdated?: () => void;
};

const deliveryDayOptions = ["Viernes", "Sábado", "Domingo"];

const deliveryTimeOptions = [
  "9:00 AM - 12:00 PM",
  "1:00 PM - 4:00 PM",
  "4:00 PM - 7:00 PM",
];

export default function EditCustomerForm({
  customer,
  onCancel,
  onUpdated,
}: EditCustomerFormProps) {
  const [fullName, setFullName] = useState(customer.full_name || "");
  const [phone, setPhone] = useState(customer.phone || "");
  const [streetAddress, setStreetAddress] = useState(
    customer.street_address || ""
  );
  const [houseOrApt, setHouseOrApt] = useState(customer.house_or_apt || "");
  const [zipCode, setZipCode] = useState(customer.zip_code || "");
  const [preferredDeliveryDay, setPreferredDeliveryDay] = useState(
    customer.preferred_delivery_day || "Viernes"
  );
  const [preferredDeliveryTime, setPreferredDeliveryTime] = useState(
    customer.preferred_delivery_time || "9:00 AM - 12:00 PM"
  );
  const [notes, setNotes] = useState(customer.notes || "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      setLoading(true);

      await updateCustomer(customer.id, {
        full_name: fullName,
        phone: phone || null,
        street_address: streetAddress || null,
        house_or_apt: houseOrApt || null,
        zip_code: zipCode || null,
        preferred_delivery_day: preferredDeliveryDay || null,
        preferred_delivery_time: preferredDeliveryTime || null,
        notes: notes || null,
      });

      onUpdated?.();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el cliente.";

      console.error("Error updating customer message:", message);
      alert(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-zinc-900">Editar cliente</h2>
        <p className="text-sm text-zinc-500">
          Actualiza los datos y preferencias de entrega.
        </p>
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
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
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
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
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
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
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
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
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
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
          </div>

          <div className="md:col-span-1 xl:col-span-1">
            <label className="mb-2 block text-sm font-medium text-zinc-800">
              Día de entrega
            </label>
            <select
              value={preferredDeliveryDay}
              onChange={(e) => setPreferredDeliveryDay(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
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
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
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
              className="min-h-[120px] w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              rows={4}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-zinc-300 px-5 py-3 font-medium text-zinc-800 transition hover:bg-zinc-50"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-black px-5 py-3 font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </section>
  );
}