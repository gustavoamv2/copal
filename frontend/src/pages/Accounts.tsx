import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Instagram, Facebook, Linkedin, CheckCircle2,
  RefreshCw, Trash2, Power, MessageCircle,
} from "lucide-react";
import { accountsApi } from "@/api/accounts";
import { whatsappApi } from "@/api/whatsapp";
import { getAccessToken } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/useToast";
import type { SocialAccount } from "@/types";
import { cn } from "@/lib/utils";

const BACKEND = import.meta.env.VITE_API_URL ?? "";

// ── AccountRow ─────────────────────────────────────────────────────────────
function AccountRow({
  account, onToggle, onDelete,
}: {
  account: SocialAccount;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const isOrg = account.account_id.startsWith("urn:li:organization:");
  const expiringSoon =
    account.token_expires_at &&
    new Date(account.token_expires_at).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`h-2 w-2 rounded-full shrink-0 ${account.is_active ? "bg-green-500" : "bg-muted-foreground/30"}`} />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {account.account_name}
            {isOrg && <span className="ml-1.5 text-xs text-muted-foreground font-normal">(Empresa)</span>}
          </p>
          <p className="text-xs text-muted-foreground truncate">{account.account_id}</p>
          {expiringSoon && (
            <p className="text-xs text-amber-500 mt-0.5">Token expira pronto — reconecta</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-3">
        <Button variant="ghost" size="icon" className="h-7 w-7" title={account.is_active ? "Desactivar" : "Activar"} onClick={onToggle}>
          <Power className={cn("h-3.5 w-3.5", account.is_active ? "text-green-500" : "text-muted-foreground")} />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Desconectar" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── PlatformCard ───────────────────────────────────────────────────────────
function PlatformCard({
  label, icon: Icon, color, bg, accounts, onToggle, onDelete, onConnect, connectLabel,
}: {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  accounts: SocialAccount[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onConnect?: () => void;
  connectLabel?: string;
}) {
  const active = accounts.filter((a) => a.is_active).length;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${bg}`}>
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
          {label}
          <Badge variant="outline" className="ml-auto text-xs">
            {active}/{accounts.length} activas
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Sin cuentas conectadas</p>
        ) : (
          accounts.map((a) => (
            <AccountRow key={a.id} account={a} onToggle={() => onToggle(a.id)} onDelete={() => onDelete(a.id)} />
          ))
        )}
        {onConnect && (
          <Button variant="outline" size="sm" className="w-full mt-3 gap-2" onClick={onConnect}>
            <RefreshCw className="h-3.5 w-3.5" />
            {connectLabel ?? "Conectar"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── WhatsAppPanel ──────────────────────────────────────────────────────────
function WhatsAppPanel() {
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [deviceName, setDeviceName] = useState("");

  const { data } = useQuery({
    queryKey: ["whatsapp-status"],
    queryFn: () => whatsappApi.status().then((r) => r.data),
  });

  const registered = data?.registered ?? false;
  const displayPhone = data?.phoneNumber ?? "";

  const handleRegister = async () => {
    if (!phone.trim()) return;
    try {
      await whatsappApi.register(deviceName.trim() || "Android", phone.replace(/\D/g, ""));
      qc.invalidateQueries({ queryKey: ["whatsapp-status"] });
      toast({ title: "Dispositivo registrado. Configura MacroDroid en tu telefono para publicar automaticamente." });
    } catch {
      toast({ title: "Error al registrar dispositivo", variant: "destructive" });
    }
  };

  const handleUnregister = async () => {
    try {
      await whatsappApi.unregister();
      qc.invalidateQueries({ queryKey: ["whatsapp-status"] });
      toast({ title: "WhatsApp desregistrado" });
    } catch {
      toast({ title: "Error al desregistrar", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-[#25D366]/10">
            <MessageCircle className="h-4 w-4 text-[#25D366]" />
          </div>
          WhatsApp Business
          <Badge
            variant="outline"
            className={cn(
              "ml-auto text-xs",
              registered && "border-green-500 text-green-500",
              !registered && "border-muted-foreground/50 text-muted-foreground"
            )}
          >
            {registered ? "Conectado" : "Desconectado"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {registered ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-green-500">
              <CheckCircle2 className="h-4 w-4" />
              <span>Dispositivo: <strong>{data?.deviceName || displayPhone}</strong></span>
            </div>
            <p className="text-xs text-muted-foreground">
              Las publicaciones se enviaran al telefono via polling del endpoint /api/whatsapp/pending.
              MacroDroid en el telefono debe consultar cada 15 minutos y publicar via UI Automation.
            </p>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">+{displayPhone}</span>
              <Button variant="outline" size="sm" onClick={handleUnregister}>Desconectar</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Registra el numero de WhatsApp Business del telefono que ejecutara la automatizacion.
            </p>
            <Input
              placeholder="Nombre del dispositivo (ej: Samsung A54)"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              className="font-mono"
            />
            <div className="flex gap-2">
              <Input
                placeholder="56912345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1 font-mono"
                onKeyDown={(e) => e.key === "Enter" && handleRegister()}
              />
              <Button size="sm" onClick={handleRegister} disabled={!phone.trim()}>
                Conectar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground/60">
              Requiere MacroDroid en el telefono con permisos de accesibilidad activados.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export function Accounts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();

  useEffect(() => {
    const connected = searchParams.get("connected");
    if (connected === "meta") {
      toast({ title: "Facebook e Instagram conectados ✓" });
      setSearchParams({}, { replace: true });
    } else if (connected === "linkedin") {
      toast({ title: "LinkedIn conectado ✓" });
      setSearchParams({}, { replace: true });
    } else if (connected === "linkedin-pages") {
      toast({ title: "Páginas de LinkedIn conectadas ✓" });
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountsApi.list().then((r) => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => accountsApi.toggle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => accountsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      toast({ title: "Cuenta desconectada" });
    },
    onError: () => toast({ title: "Error al desconectar", variant: "destructive" }),
  });

  const connectOAuth = (path: string) => {
    const token = getAccessToken();
    if (!token) { toast({ title: "Sesión expirada, recarga la página", variant: "destructive" }); return; }
    window.location.href = `${BACKEND}/api/oauth/${path}/connect?token=${token}`;
  };

  const fb = accounts.filter((a) => a.platform === "facebook");
  const ig = accounts.filter((a) => a.platform === "instagram");
  const li = accounts.filter((a) => a.platform === "linkedin");
  const liPersonal = li.filter((a) => !a.account_id.startsWith("urn:li:organization:"));
  const liPages = li.filter((a) => a.account_id.startsWith("urn:li:organization:"));

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Cuentas conectadas</h1>
        <p className="text-muted-foreground text-sm mt-1">Administra tus redes sociales conectadas</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-4">
          <PlatformCard
            label="Facebook"
            icon={Facebook}
            color="text-[#1877F2]"
            bg="bg-[#1877F2]/10"
            accounts={fb}
            onToggle={(id) => toggleMutation.mutate(id)}
            onDelete={(id) => deleteMutation.mutate(id)}
            onConnect={() => connectOAuth("meta")}
            connectLabel={fb.length > 0 ? "Reconectar Facebook & Instagram" : "Conectar Facebook & Instagram"}
          />
          <PlatformCard
            label="Instagram"
            icon={Instagram}
            color="text-[#E1306C]"
            bg="bg-[#E1306C]/10"
            accounts={ig}
            onToggle={(id) => toggleMutation.mutate(id)}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
          <PlatformCard
            label="LinkedIn (Perfil)"
            icon={Linkedin}
            color="text-[#0A66C2]"
            bg="bg-[#0A66C2]/10"
            accounts={liPersonal}
            onToggle={(id) => toggleMutation.mutate(id)}
            onDelete={(id) => deleteMutation.mutate(id)}
            onConnect={() => connectOAuth("linkedin")}
            connectLabel={liPersonal.length > 0 ? "Reconectar LinkedIn" : "Conectar LinkedIn"}
          />
          <PlatformCard
            label="LinkedIn (Página de empresa)"
            icon={Linkedin}
            color="text-[#0A66C2]"
            bg="bg-[#0A66C2]/10"
            accounts={liPages}
            onToggle={(id) => toggleMutation.mutate(id)}
            onDelete={(id) => deleteMutation.mutate(id)}
            onConnect={() => connectOAuth("linkedin-pages")}
            connectLabel={liPages.length > 0 ? "Reconectar páginas" : "Conectar página de empresa"}
          />
          <WhatsAppPanel />
        </div>
      )}
    </div>
  );
}
