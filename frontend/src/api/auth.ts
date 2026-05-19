import api from "./client";
import { User } from "@/types";

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ access_token: string; user: User }>("/auth/login", { email, password }),

  logout: () => api.post("/auth/logout"),

  refresh: () => api.post<{ access_token: string }>("/auth/refresh"),

  me: () => api.get<User>("/auth/me"),
};
