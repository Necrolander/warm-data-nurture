import { supabase } from "@/integrations/supabase/client";

export interface DriverSession {
  id: string;
  name: string;
  phone: string;
  token: string;
}

export const DRIVER_STORAGE_KEYS = {
  id: "driver_id",
  name: "driver_name",
  phone: "driver_phone",
  token: "driver_token",
} as const;

export const getDriverToken = () => localStorage.getItem(DRIVER_STORAGE_KEYS.token);

export const getDriverSession = (): DriverSession | null => {
  const id = localStorage.getItem(DRIVER_STORAGE_KEYS.id);
  const name = localStorage.getItem(DRIVER_STORAGE_KEYS.name);
  const phone = localStorage.getItem(DRIVER_STORAGE_KEYS.phone);
  const token = localStorage.getItem(DRIVER_STORAGE_KEYS.token);

  if (!id || !name || !phone || !token) return null;
  return { id, name, phone, token };
};

export const saveDriverSession = (session: DriverSession) => {
  localStorage.setItem(DRIVER_STORAGE_KEYS.id, session.id);
  localStorage.setItem(DRIVER_STORAGE_KEYS.name, session.name);
  localStorage.setItem(DRIVER_STORAGE_KEYS.phone, session.phone);
  localStorage.setItem(DRIVER_STORAGE_KEYS.token, session.token);
};

export const clearDriverSession = () => {
  localStorage.removeItem(DRIVER_STORAGE_KEYS.id);
  localStorage.removeItem(DRIVER_STORAGE_KEYS.name);
  localStorage.removeItem(DRIVER_STORAGE_KEYS.phone);
  localStorage.removeItem(DRIVER_STORAGE_KEYS.token);
};

export async function invokeDriverApp<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const token = getDriverToken();
  if (!token) throw new Error("Sessão do entregador expirada");

  const { data, error } = await supabase.functions.invoke("driver-app", {
    body: { action, token, ...payload },
  });

  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}
