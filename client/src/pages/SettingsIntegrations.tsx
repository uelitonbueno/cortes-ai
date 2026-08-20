import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Check, KeyRound, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const platforms = [
  { key: "youtube" as const, name: "YouTube Shorts", accent: "#ff5b67" },
  { key: "tiktok" as const, name: "TikTok", accent: "#111827" },
  { key: "instagram" as const, name: "Instagram Reels", accent: "#c026d3" },
];

export default function SettingsIntegrations() {
  const settings = trpc.integrations.list.useQuery();
  const utils = trpc.useUtils();
  const save = trpc.integrations.save.useMutation({
    onSuccess: () => {
      toast.success("Configuração salva com segurança");
      utils.integrations.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const [draft, setDraft] = useState<
    Record<string, { token: string; endpoint: string; enabled: boolean }>
  >({});
  const valueFor = (platform: string) =>
    draft[platform] ?? { token: "", endpoint: "", enabled: false };
  const update = (
    platform: string,
    patch: Partial<{ token: string; endpoint: string; enabled: boolean }>
  ) =>
    setDraft(current => ({
      ...current,
      [platform]: { ...valueFor(platform), ...patch },
    }));
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-700">
            Configurações
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            Integrações de publicação
          </h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Cadastre posteriormente os acessos das plataformas. Os tokens nunca
            são exibidos por completo e a publicação permanece desligada até sua
            ativação explícita.
          </p>
        </div>
        <Card className="border-cyan-100 bg-cyan-50/60">
          <CardContent className="flex gap-3 p-5 text-sm text-cyan-950">
            <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" />
            <p>
              Recomendação: use tokens OAuth com escopo mínimo e endpoints
              autorizados pelo seu gateway. O Cortes AI não publica enquanto uma
              integração estiver desativada.
            </p>
          </CardContent>
        </Card>
        {platforms.map(platform => {
          const saved = settings.data?.find(
            item => item.platform === platform.key
          );
          const current = valueFor(platform.key);
          return (
            <Card
              key={platform.key}
              className="border-0 bg-white shadow-sm shadow-slate-200/70"
            >
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: platform.accent }}
                  />
                  <CardTitle>{platform.name}</CardTitle>
                </div>
                <Badge variant={saved?.enabled ? "default" : "secondary"}>
                  {saved?.enabled ? "Ativa" : "Desativada"}
                </Badge>
              </CardHeader>
              <CardContent className="grid gap-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <div>
                  <Label htmlFor={`${platform.key}-token`}>Token OAuth</Label>
                  <Input
                    id={`${platform.key}-token`}
                    type="password"
                    value={current.token}
                    onChange={event =>
                      update(platform.key, { token: event.target.value })
                    }
                    placeholder={
                      saved?.accessToken ??
                      "Cole o token somente quando quiser substituir"
                    }
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor={`${platform.key}-endpoint`}>
                    Endpoint de publicação
                  </Label>
                  <Input
                    id={`${platform.key}-endpoint`}
                    value={current.endpoint}
                    onChange={event =>
                      update(platform.key, { endpoint: event.target.value })
                    }
                    placeholder={saved?.publishEndpoint ?? "https://..."}
                    className="mt-2"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={current.enabled}
                    onCheckedChange={enabled =>
                      update(platform.key, { enabled })
                    }
                    aria-label={`Ativar ${platform.name}`}
                  />
                  <Button
                    disabled={save.isPending}
                    onClick={() =>
                      save.mutate({
                        platform: platform.key,
                        accessToken: current.token || undefined,
                        publishEndpoint: current.endpoint,
                        enabled: current.enabled,
                      })
                    }
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Salvar
                  </Button>
                </div>
              </CardContent>
              {saved && (
                <div className="flex items-center gap-2 border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  Última configuração salva sem exibir o token completo.
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
