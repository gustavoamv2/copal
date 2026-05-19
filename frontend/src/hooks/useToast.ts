import { useState, useCallback } from "react";

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

let externalToast: ((item: Omit<ToastItem, "id">) => void) | null = null;

export function useToastStore() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((item: Omit<ToastItem, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...item, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  externalToast = toast;

  return { toasts, dismiss: (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)) };
}

export function toast(item: Omit<ToastItem, "id">) {
  externalToast?.(item);
}
