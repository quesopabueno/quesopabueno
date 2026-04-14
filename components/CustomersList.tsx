"use client";

import { useEffect, useMemo, useState } from "react";
import { deleteCustomer, getCustomers } from "@/lib/customers";
import type { Customer } from "@/types/customer";
import EditCustomerForm from "@/components/EditCustomerForm";

type CustomersListProps = {
  refreshKey?: number;
};

const ITEMS_PER_PAGE = 10;

function buildAddress(customer: Customer) {
  const parts = [
    customer.street_address,
    customer.house_or_apt,
    customer.zip_code,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "—";
}

export default function CustomersList({
  refreshKey = 0,
}: CustomersListProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(
    null
  );
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(
    null
  );

  async function loadCustomers() {
    try {
      setLoading(true);
      const data = await getCustomers();
      setCustomers(data);
    } catch (error) {
      console.error("Error loading customers:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, [refreshKey]);

  useEffect(() => {
    setCurrentPage(1);
    setExpandedCustomerId(null);
  }, [search]);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return customers;

    return customers.filter((customer) => {
      const fullName = customer.full_name?.toLowerCase() || "";
      return fullName.includes(term);
    });
  }, [customers, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE)
  );

  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredCustomers.slice(start, end);
  }, [filteredCustomers, currentPage]);

  async function handleDelete(customer: Customer) {
    const confirmed = window.confirm(
      `¿Eliminar a "${customer.full_name}"? Esta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    try {
      setDeletingCustomerId(customer.id);
      await deleteCustomer(customer.id);
      if (expandedCustomerId === customer.id) {
        setExpandedCustomerId(null);
      }
      await loadCustomers();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el cliente.";

      console.error("Error deleting customer message:", message);
      alert(message);
    } finally {
      setDeletingCustomerId(null);
    }
  }

  function toggleExpanded(customerId: string) {
    setExpandedCustomerId((prev) => (prev === customerId ? null : customerId));
  }

  if (editingCustomer) {
    return (
      <EditCustomerForm
        customer={editingCustomer}
        onCancel={() => setEditingCustomer(null)}
        onUpdated={async () => {
          setEditingCustomer(null);
          setExpandedCustomerId(null);
          await loadCustomers();
        }}
      />
    );
  }

  if (loading) {
    return (
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-zinc-900">
            Clientes registrados
          </h2>
          <p className="text-sm text-zinc-500">
            Cargando información de clientes...
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">
            Clientes registrados
          </h2>
          <p className="text-sm text-zinc-500">
            {filteredCustomers.length} resultado
            {filteredCustomers.length === 1 ? "" : "s"} · página {currentPage} de{" "}
            {totalPages}
          </p>
        </div>

        <div className="w-full md:max-w-sm">
          <label className="mb-2 block text-sm font-medium text-zinc-800">
            Buscar cliente
          </label>
          <input
            type="text"
            placeholder="Escribe el nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
          />
        </div>
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500">
          No se encontraron clientes.
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paginatedCustomers.map((customer) => {
              const isExpanded = expandedCustomerId === customer.id;

              return (
                <article
                  key={customer.id}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(customer.id)}
                      className="text-left"
                    >
                      <h3 className="text-base font-semibold text-zinc-900 underline-offset-4 hover:underline">
                        {customer.full_name}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        {isExpanded
                          ? "Toca para cerrar"
                          : "Toca el nombre para ver detalle"}
                      </p>
                    </button>

                    <div className="text-sm font-medium text-zinc-500">
                      {isExpanded ? "Abierto" : "Cerrado"}
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                      <div className="grid gap-4 text-sm text-zinc-700 md:grid-cols-2">
                        <div>
                          <p className="font-semibold text-zinc-900">
                            Teléfono
                          </p>
                          <p>{customer.phone || "—"}</p>
                        </div>

                        <div>
                          <p className="font-semibold text-zinc-900">
                            Dirección
                          </p>
                          <p>{buildAddress(customer)}</p>
                        </div>

                        <div>
                          <p className="font-semibold text-zinc-900">
                            Día de entrega
                          </p>
                          <p>{customer.preferred_delivery_day || "—"}</p>
                        </div>

                        <div>
                          <p className="font-semibold text-zinc-900">
                            Horario
                          </p>
                          <p>{customer.preferred_delivery_time || "—"}</p>
                        </div>

                        <div className="md:col-span-2">
                          <p className="font-semibold text-zinc-900">Notas</p>
                          <p>{customer.notes || "—"}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col gap-2 border-t border-zinc-200 pt-4 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => setEditingCustomer(customer)}
                          className="rounded-xl border border-zinc-300 bg-white px-4 py-2 font-medium text-zinc-900 transition hover:bg-zinc-100"
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(customer)}
                          disabled={deletingCustomerId === customer.id}
                          className="rounded-xl border border-red-300 bg-white px-4 py-2 font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingCustomerId === customer.id
                            ? "Eliminando..."
                            : "Eliminar"}
                        </button>

                        <button
                          type="button"
                          onClick={() => setExpandedCustomerId(null)}
                          className="rounded-xl border border-zinc-300 bg-white px-4 py-2 font-medium text-zinc-700 transition hover:bg-zinc-100"
                        >
                          Cerrar
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-500">
              Mostrando {paginatedCustomers.length} de {filteredCustomers.length}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setCurrentPage((prev) => Math.max(1, prev - 1));
                  setExpandedCustomerId(null);
                }}
                disabled={currentPage === 1}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 font-medium text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1));
                  setExpandedCustomerId(null);
                }}
                disabled={currentPage === totalPages}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 font-medium text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}