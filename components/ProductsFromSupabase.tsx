"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type DbProduct = {
  id: number;
  name: string;
  description: string | null;
  unit: string | null;
  price: number | null;
  category_id: number | null;
};

const categoryMap: Record<number, string> = {
  1: "Quesos",
  2: "Lácteos / cremas / suero",
  3: "Promociones",
};

export default function ProductsFromSupabase() {
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProducts = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, description, unit, price, category_id")
        .order("id", { ascending: true });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setProducts((data ?? []) as DbProduct[]);
      setLoading(false);
    };

    loadProducts();
  }, []);

  if (loading) {
    return <div>Cargando productos desde Supabase...</div>;
  }

  if (error) {
    return <div>Error cargando productos: {error}</div>;
  }

  return (
    <div className="space-y-3">
      {products.map((product) => (
        <div key={product.id} className="rounded-2xl border p-4">
          <div className="font-semibold">{product.name}</div>
          <div>{categoryMap[product.category_id ?? 0] ?? "Sin categoría"}</div>
          <div>{product.description ?? "Sin descripción"}</div>
          <div>
            ${product.price ?? 0} / {product.unit ?? "unidad"}
          </div>
        </div>
      ))}
    </div>
  );
}