import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CalendarDays, Image, Zap } from "lucide-react";

export function Login() {
  const { login, user } = useAuth();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch {
      setError("Credenciales inválidas. Verifica tu email y contraseña.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">

      {/* ── Left panel — branding ─────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 bg-card border-r border-border px-10 py-12">
        {/* Logo + name */}
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Actualizate con IA"
            className="h-10 w-10 rounded-lg object-contain"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
          <span className="font-semibold text-foreground">Actualizate con IA</span>
        </div>

        {/* Hero */}
        <div className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-3xl font-bold leading-tight">
              Gestiona tus redes sociales con inteligencia
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Programa, organiza y publica contenido en Instagram, Facebook y LinkedIn desde un solo lugar.
              Importa calendarios completos y visualiza tu estrategia mes a mes.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                icon: CalendarDays,
                title: "Calendario visual",
                desc: "Visualiza todas tus publicaciones programadas en una vista mensual.",
              },
              {
                icon: Image,
                title: "Biblioteca de medios",
                desc: "Sube y organiza imágenes y videos para todas tus publicaciones.",
              },
              {
                icon: Zap,
                title: "Importación masiva",
                desc: "Importa un calendario completo de hasta 110 publicaciones con un clic.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground/50">
          © {new Date().getFullYear()} Actualizate con IA · Todos los derechos reservados
        </p>
      </div>

      {/* ── Right panel — form ────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">

          {/* Mobile logo (only shows on small screens) */}
          <div className="flex flex-col items-center gap-3 lg:hidden">
            <img
              src="/logo.png"
              alt="Actualizate con IA"
              className="h-16 w-16 rounded-xl object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
            <div className="text-center">
              <h1 className="text-xl font-semibold">Actualizate con IA</h1>
              <p className="text-sm text-muted-foreground">Gestión de redes sociales</p>
            </div>
          </div>

          <div className="hidden lg:block">
            <h1 className="text-2xl font-bold">Bienvenido</h1>
            <p className="text-sm text-muted-foreground mt-1">Ingresa a tu cuenta para continuar</p>
          </div>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Iniciar sesión</CardTitle>
              <CardDescription>Ingresa tus credenciales para continuar</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Contraseña</Label>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Ingresando..." : "Ingresar"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <Link to="/register" className="text-primary hover:underline font-medium">
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
