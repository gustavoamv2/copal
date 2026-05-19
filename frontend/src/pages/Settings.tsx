import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/useToast";

const TIMEZONES = [
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/Lima",
  "America/Bogota",
  "America/Mexico_City",
  "America/New_York",
  "Europe/Madrid",
  "UTC",
];

export function Settings() {
  const qc = useQueryClient();
  const [timezone, setTimezone] = useState("America/Santiago");

  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<{ timezone: string; email: string }>("/settings").then((r) => r.data),
  });

  useEffect(() => {
    if (data?.timezone) setTimezone(data.timezone);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.patch("/settings", { timezone }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast({ title: "Configuración guardada" });
    },
    onError: () => toast({ title: "Error al guardar", variant: "destructive" }),
  });

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-muted-foreground text-sm mt-1">Preferencias de tu cuenta</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Zona horaria</CardTitle>
          <CardDescription>
            Afecta la hora de publicación de todos los posts programados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Zona horaria</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Email</Label>
            <p className="text-sm text-muted-foreground border border-border rounded-md px-3 py-2 bg-input/50">
              {data?.email ?? "—"}
            </p>
          </div>

          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
