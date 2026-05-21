import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/components/AuthProvider";
import { Layout } from "@/components/Layout";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { ForgotPassword } from "@/pages/ForgotPassword";
import { Dashboard } from "@/pages/Dashboard";
import { NewPost } from "@/pages/NewPost";
import { CalendarPage } from "@/pages/CalendarPage";
import { Media } from "@/pages/Media";
import { Scheduled } from "@/pages/Scheduled";
import { History } from "@/pages/History";
import { Settings } from "@/pages/Settings";
import { Accounts } from "@/pages/Accounts";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login"           element={<Login />} />
            <Route path="/register"        element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* App (requires auth via Layout) */}
            <Route element={<Layout />}>
              <Route path="/"           element={<Dashboard />} />
              <Route path="/posts/new"  element={<NewPost />} />
              <Route path="/calendar"   element={<CalendarPage />} />
              <Route path="/media"      element={<Media />} />
              <Route path="/scheduled"  element={<Scheduled />} />
              <Route path="/history"    element={<History />} />
              <Route path="/settings"   element={<Settings />} />
              <Route path="/accounts"  element={<Accounts />} />

              {/* Catch-all: redirect stale URLs to dashboard */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
