import api from "./client";
import { SocialAccount } from "@/types";

export const accountsApi = {
  list: () => api.get<SocialAccount[]>("/accounts"),
  delete: (id: string) => api.delete(`/accounts/${id}`),
  toggle: (id: string) => api.patch<{ id: string; is_active: boolean }>(`/accounts/${id}/toggle`),
};
