"use client";

import { useState } from "react";
import CustomerForm from "@/components/CustomerForm";
import CustomersList from "@/components/CustomersList";

export default function CustomersSection() {
  const [refreshKey, setRefreshKey] = useState(0);

  function handleCustomerCreated() {
    setRefreshKey((prev) => prev + 1);
  }

  return (
    <section className="space-y-6">
      <CustomerForm onCustomerCreated={handleCustomerCreated} />
      <CustomersList refreshKey={refreshKey} />
    </section>
  );
}