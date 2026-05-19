import { useState, useEffect, useCallback, ReactNode } from "react";
import { AuthContext } from "@/hooks/useAuth";
import { authApi } from "@/api/auth";
import { setAccessToken } from "@/api/client";
import { User } from "@/types";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Attempt silent refresh on mount
  useEffect(() => {
    authApi
      .refresh()
      .then(async ({ data }) => {
        setAccessToken(data.access_token);
        setToken(data.access_token);
        const { data: me } = await authApi.me();
        setUser(me);
      })
      .catch(() => {
        setAccessToken(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    setAccessToken(data.access_token);
    setToken(data.access_token);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    setAccessToken(null);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
