import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Instagram, Facebook, Linkedin, CheckCircle2,
  RefreshCw, Trash2, Power, MessageCircle, Loader2,
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
  const [connecting, setConnecting] = useState(false);

  const [hasPairingCode, setHasPairingCode] = useState(false);

  const { data } = useQuery({
    queryKey: ["whatsapp-status"],
    queryFn: () => whatsappApi.status().then((r) => r.data),
    // Poll while connecting or while waiting for user to enter pairing code
    refetchInterval: connecting || hasPairingCode ? 2000 : false,
  });

  const status      = data?.status ?? "disconnected";
  const pairingCode = data?.pairingCode ?? null;

  // Keep hasPairingCode in sync
  useEffect(() => {
    setHasPairingCode(!!pairingCode);
  }, [pairingCode]);

  useEffect(() => {
    if (status === "connected" && connecting) {
      setConnecting(false);
      toast({ title: "WhatsApp conectado ✓" });
    }
  }, [status, connecting]);

  const handleConnect = async () => {
    if (!phone.trim()) return;
    setConnecting(true);
    try {
      await whatsappApi.connect(phone.replace(/\D/g, ""));
      qc.invalidateQueries({ queryKey: ["whatsapp-status"] });
    } catch {
      toast({ title: "Error al iniciar conexión", variant: "destructive" });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await whatsappApi.disconnect();
      qc.invalidateQueries({ queryKey: ["whatsapp-status"] });
      toast({ title: "WhatsApp desconectado" });
    } catch {
      toast({ title: "Error al desconectar", variant: "destructive" });
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
              status === "connected" && "border-green-500 text-green-500",
              status === "qr_pending" && "border-amber-500 text-amber-500",
              status === "disconnected" && "border-muted-foreground/50 text-muted-foreground"
            )}
          >
            {status === "connected" ? "Conectado" : status === "qr_pending" ? "Conectando…" : "Desconectado"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "connected" ? (
          /* ── Connected ── */
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-green-500">
              <CheckCircle2 className="h-4 w-4" />
              Listo para publicar estados
            </div>
            <Button variant="outline" size="sm" onClick={handleDisconnect}>Desconectar</Button>
          </div>

        ) : pairingCode ? (
          /* ── Pairing code received — waiting for user to enter it on phone ── */
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Abre WhatsApp en tu teléfono e ingresa este código:
            </p>
            <div className="flex items-center gap-3">
              <div className="font-mono text-2xl font-bold tracking-[0.3em] bg-muted px-5 py-3 rounded-lg select-all">
                {pairingCode}
              </div>
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" />
            </div>
            <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal list-inside">
              <li>Ajustes → Dispositivos vinculados</li>
              <li>Toca <strong>Vincular con número de teléfono</strong></li>
              <li>Ingresa el código de arriba</li>
            </ol>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive w-full" onClick={handleDisconnect}>
              Cancelar
            </Button>
          </div>

        ) : connecting ? (
          /* ── Waiting for code to arrive from server ── */
          <div className="flex items-center gap-2 text-sm text-amber-500 py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Solicitando código de emparejamiento…
          </div>

        ) : (
          /* ── Disconnected — show connect form ── */
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Ingresa el número de WhatsApp Business con código de país (sin +)
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="56912345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1 font-mono"
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
              />
              <Button size="sm" onClick={handleConnect} disabled={!phone.trim()}>
                Conectar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground/60">
              Requiere WhatsApp o WhatsApp Business con multidispositivo activado.
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
            label="LinkedIn"
            icon={Linkedin}
            color="text-[#0A66C2]"
            bg="bg-[#0A66C2]/10"
            accounts={li}
            onToggle={(id) => toggleMutation.mutate(id)}
            onDelete={(id) => deleteMutation.mutate(id)}
            onConnect={() => connectOAuth("linkedin")}
            connectLabel={li.length > 0 ? "Reconectar LinkedIn" : "Conectar LinkedIn"}
          />
          <WhatsAppPanel />
        </div>
      )}
    </div>
  );
}
