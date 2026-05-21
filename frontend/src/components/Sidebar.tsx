import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  PenSquare,
  CalendarDays,
  Image,
  Clock,
  History,
  Settings,
  LogOut,
  Zap,
  Link2,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/posts/new", icon: PenSquare, label: "Nueva publicación" },
  { to: "/preview", icon: LayoutGrid, label: "Catálogo semanal" },
  { to: "/calendar", icon: CalendarDays, label: "Calendario" },
  { to: "/media", icon: Image, label: "Biblioteca" },
  { to: "/scheduled", icon: Clock, label: "Programadas" },
  { to: "/history", icon: History, label: "Historial" },
  { to: "/accounts", icon: Link2,    label: "Cuentas" },
  { to: "/settings", icon: Settings, label: "Configuración" },
];

export function Sidebar() {
  const { logout, user } = useAuth();

  return (
    <aside className="flex flex-col w-60 shrink-0 border-r border-sidebar-border bg-sidebar h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <span className="font-semibold text-foreground">Copal</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border px-4 py-3 space-y-2">
        <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );
}
