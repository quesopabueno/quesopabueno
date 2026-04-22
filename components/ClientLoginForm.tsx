"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type ClientLoginFormProps = {
  onLoggedIn?: () => void;
};

export default function ClientLoginForm({
  onLoggedIn,
}: ClientLoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const savedEmail = localStorage.getItem("qpb_remembered_email");
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

  function mapLoginError(message: string) {
    const normalized = message.toLowerCase();

    if (
      normalized.includes("invalid login credentials") ||
      normalized.includes("invalid_credentials")
    ) {
      return "Correo o contraseña incorrectos.";
    }

    if (
      normalized.includes("email not confirmed") ||
      normalized.includes("email_not_confirmed")
    ) {
      return "Debes confirmar tu correo antes de ingresar.";
    }

    if (normalized.includes("too many requests")) {
      return "Demasiados intentos. Espera un momento y vuelve a intentar.";
    }

    return message;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSuccessMessage("");
    setErrorMessage("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setErrorMessage("Debes ingresar tu correo electrónico.");
      return;
    }

    if (!password) {
      setErrorMessage("Debes ingresar tu contraseña.");
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        throw new Error(mapLoginError(error.message));
      }

      if (!data.session) {
        throw new Error("No se pudo iniciar la sesión correctamente.");
      }

      localStorage.setItem("qpb_remembered_email", normalizedEmail);
      setSuccessMessage("Inicio de sesión correcto.");
      onLoggedIn?.();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo iniciar sesión.";

      console.error("Client login error:", message);
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-zinc-900">Iniciar sesión</h2>
        <p className="text-sm text-zinc-500">
          Entra con tu correo y contraseña para acceder a tu cuenta.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
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

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-800">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña"
              autoComplete="current-password"
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
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
            disabled={loading}
            className="rounded-xl bg-black px-5 py-3 font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </div>
      </form>
    </section>
  );
}