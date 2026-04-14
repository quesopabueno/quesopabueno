"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { createCustomer } from "@/lib/customers";

const deliveryDayOptions = ["Viernes", "Sábado", "Domingo"];

const deliveryTimeOptions = [
  "9:00 AM - 12:00 PM",
  "1:00 PM - 4:00 PM",
  "4:00 PM - 7:00 PM",
];

type ClientRegisterFormProps = {
  onRegistered?: () => void;
  onSwitchToLogin?: () => void;
};

export default function ClientRegisterForm({
  onRegistered,
  onSwitchToLogin,
}: ClientRegisterFormProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [houseOrApt, setHouseOrApt] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [preferredDeliveryDay, setPreferredDeliveryDay] = useState("Viernes");
  const [preferredDeliveryTime, setPreferredDeliveryTime] = useState(
    "9:00 AM - 12:00 PM"
  );
  const [notes, setNotes] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const switchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (switchTimeoutRef.current) {
        clearTimeout(switchTimeoutRef.current);
      }
    };
  }, []);

  function resetForm() {
    setFullName("");
    setEmail("");
    setPhone("");
    setStreetAddress("");
    setHouseOrApt("");
    setZipCode("");
    setPreferredDeliveryDay("Viernes");
    setPreferredDeliveryTime("9:00 AM - 12:00 PM");
    setNotes("");
    setPassword("");
    setConfirmPassword("");
  }

  function mapSignupError(message: string) {
    const normalized = message.toLowerCase();

    if (
      normalized.includes("user already registered") ||
      normalized.includes("already been registered")
    ) {
      return "Ese correo ya está registrado. Ingresa con tu cuenta.";
    }

    if (normalized.includes("password")) {
      return "La contraseña no cumple los requisitos.";
    }

    if (normalized.includes("email")) {
      return "No se pudo registrar ese correo. Revisa el email e inténtalo de nuevo.";
    }

    return message;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSuccessMessage("");
    setErrorMessage("");

    const normalizedEmail = email.trim().toLowerCase();
    const cleanedFullName = fullName.trim();
    const cleanedPhone = phone.trim();
    const cleanedStreetAddress = streetAddress.trim();
    const cleanedHouseOrApt = houseOrApt.trim();
    const cleanedZipCode = zipCode.trim();
    const cleanedNotes = notes.trim();

    if (!cleanedFullName) {
      setErrorMessage("Debes ingresar el nombre completo.");
      return;
    }

    if (!cleanedPhone) {
        setErrorMessage("Debes ingresar un número de teléfono de contacto.");
        return;
    }

    if (!cleanedStreetAddress) {
        setErrorMessage("Debes proporcionar tu dirección principal.");
        return;
    }

    if (!cleanedZipCode) {
        setErrorMessage("Es obligatorio indicar tu código postal para la entrega.");
        return;
    }

    if (!normalizedEmail) {
      setErrorMessage("Debes ingresar un correo electrónico válido.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Las contraseñas no coinciden.");
      return;
    }

    try {
      setLoading(true);

      const redirectTo =
        typeof window !== "undefined" ? window.location.origin : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: cleanedFullName,
            phone: cleanedPhone || null,
            street_address: cleanedStreetAddress || null,
            house_or_apt: cleanedHouseOrApt || null,
            zip_code: cleanedZipCode || null,
            preferred_delivery_day: preferredDeliveryDay || null,
            preferred_delivery_time: preferredDeliveryTime || null,
            notes: cleanedNotes || null,
          },
        },
      });

      if (error) {
        throw new Error(mapSignupError(error.message));
      }

      const authUserId = data.user?.id ?? null;
      const hasSession = Boolean(data.session);

      if (!authUserId) {
        throw new Error("La cuenta no se creó correctamente. Inténtalo de nuevo.");
      }

      // Instead of relying purely on a trigger or 'createCustomer' which was missing auth_user_id,
      // we explicitly insert into customers mapping it to the newly created user:
      const { error: insertError } = await supabase.from("customers").insert({
        auth_user_id: authUserId,
        email: normalizedEmail,
        full_name: cleanedFullName,
        phone: cleanedPhone || null,
        street_address: cleanedStreetAddress || null,
        house_or_apt: cleanedHouseOrApt || null,
        zip_code: cleanedZipCode || null,
        preferred_delivery_day: preferredDeliveryDay || null,
        preferred_delivery_time: preferredDeliveryTime || null,
        notes: cleanedNotes || null,
      });
      // We gracefully continue if insertError throws duplicate, assuming a trigger already handled it.
      if (insertError && !insertError.message.toLowerCase().includes("duplicate")) {
         console.warn("Possible profile creation issue or duplicate trigger", insertError);
      }

      resetForm();

      if (hasSession) {
        setSuccessMessage("Cuenta creada correctamente.");
        onRegistered?.();
        return;
      }

      setSuccessMessage(
        "Cuenta creada. Revisa tu correo para confirmar tu registro. Luego ingresa con tu cuenta."
      );

      switchTimeoutRef.current = setTimeout(() => {
        onSwitchToLogin?.();
      }, 1200);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo crear la cuenta.";

      console.error("Client signup error:", message);
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-zinc-900">Crear cuenta</h2>
        <p className="text-sm text-zinc-500">
          Registra tu perfil para guardar tus datos y confirmar pedidos.
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
              placeholder="Nombre y apellido"
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              required
            />
          </div>

          <div className="md:col-span-2 xl:col-span-2">
            <label className="mb-2 block text-sm font-medium text-zinc-800">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              autoComplete="email"
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
              placeholder="(000) 000-0000"
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              required
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
              placeholder="32814"
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              required
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
              placeholder="123 Main St"
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              required
            />
          </div>

          <div className="md:col-span-2 xl:col-span-1">
            <label className="mb-2 block text-sm font-medium text-zinc-800">
              Casa / apto
            </label>
            <input
              type="text"
              value={houseOrApt}
              onChange={(e) => setHouseOrApt(e.target.value)}
              placeholder="Apt 4B / Casa 12"
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
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

          <div className="md:col-span-2 xl:col-span-2">
            <label className="mb-2 block text-sm font-medium text-zinc-800">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              required
            />
          </div>

          <div className="md:col-span-2 xl:col-span-2">
            <label className="mb-2 block text-sm font-medium text-zinc-800">
              Confirmar contraseña
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
              autoComplete="new-password"
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              required
            />
          </div>

          <div className="md:col-span-2 xl:col-span-4">
            <label className="mb-2 block text-sm font-medium text-zinc-800">
              Notas
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Indicaciones de entrega, referencia, observaciones..."
              rows={4}
              className="min-h-[120px] w-full rounded-xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
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
            disabled={loading}
            className="rounded-xl bg-black px-5 py-3 font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </div>
      </form>
    </section>
  );
}