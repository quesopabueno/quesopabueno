import { supabase } from "./supabase";
import type { Customer } from "../types/customer";

type CustomerInput = Omit<Customer, "id" | "created_at">;

export async function getCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching customers:");
    console.error("message:", error.message);
    console.error("details:", error.details);
    console.error("hint:", error.hint);
    console.error("code:", error.code);
    return [];
  }

  return (data ?? []) as Customer[];
}

export async function createCustomer(
  customer: CustomerInput
): Promise<Customer> {
  const { data, error } = await supabase
    .from("customers")
    .insert([customer])
    .select()
    .single();

  if (error) {
    console.error("Error creating customer:");
    console.error("message:", error.message);
    console.error("details:", error.details);
    console.error("hint:", error.hint);
    console.error("code:", error.code);

    throw new Error(
      `Supabase error: ${error.message} | code: ${error.code ?? "N/A"}`
    );
  }

  return data as Customer;
}

export async function updateCustomer(
  id: string,
  customer: CustomerInput
): Promise<Customer> {
  const { data, error } = await supabase
    .from("customers")
    .update(customer)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating customer:");
    console.error("message:", error.message);
    console.error("details:", error.details);
    console.error("hint:", error.hint);
    console.error("code:", error.code);

    throw new Error(
      `Supabase error: ${error.message} | code: ${error.code ?? "N/A"}`
    );
  }

  return data as Customer;
}

export async function deleteCustomer(id: string): Promise<boolean> {
  const { error } = await supabase.from("customers").delete().eq("id", id);

  if (error) {
    console.error("Error deleting customer:");
    console.error("message:", error.message);
    console.error("details:", error.details);
    console.error("hint:", error.hint);
    console.error("code:", error.code);

    throw new Error(
      `Supabase error: ${error.message} | code: ${error.code ?? "N/A"}`
    );
  }

  return true;
}