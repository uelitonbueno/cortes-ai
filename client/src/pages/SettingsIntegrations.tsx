import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Check, KeyRound, Save, Palette, Plus } from "lucide-react";
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
            Preferências
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            Configurações
          </h1>
        </div>

        <Tabs defaultValue="integrations" className="w-full">
          <TabsList className="mb-4 bg-slate-100 p-1">
            <TabsTrigger value="integrations">Integrações</TabsTrigger>
            <TabsTrigger value="brand">Brand Kits</TabsTrigger>
          </TabsList>

          <TabsContent value="integrations" className="space-y-6">
            <Card className="border-cyan-100 bg-cyan-50/60">
              <CardContent className="flex gap-3 p-5 text-sm text-cyan-950">
                <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" />
                <p>
                  Recomendação: use tokens OAuth com escopo mínimo e endpoints
                  autorizados pelo seu gateway. O Cortes AI não publica enquanto
                  uma integração estiver desativada.
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
      </TabsContent>

          <TabsContent value="brand">
            <BrandKitManager />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function BrandKitManager() {
  const kits = trpc.brandKits.list.useQuery();
  const utils = trpc.useUtils();
  const save = trpc.brandKits.save.useMutation({
    onSuccess: () => {
      toast.success("Brand Kit salvo");
      utils.brandKits.list.invalidate();
      setIsAdding(false);
      setName("");
    },
    onError: error => toast.error(error.message),
  });

  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [primary, setPrimary] = useState("#00d7ff");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Seus Brand Kits</h2>
        <Button
          onClick={() => setIsAdding(true)}
          className="bg-cyan-600 hover:bg-cyan-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo Kit
        </Button>
      </div>

      {isAdding && (
        <Card className="border-2 border-cyan-100 bg-white shadow-md">
          <CardContent className="p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Nome do Kit</Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Estilo Podcast"
                />
              </div>
              <div>
                <Label>Cor Primária</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={primary}
                    onChange={e => setPrimary(e.target.value)}
                    className="h-10 w-20 p-1"
                  />
                  <Input
                    value={primary}
                    onChange={e => setPrimary(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsAdding(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => save.mutate({ name, primaryColor: primary })}
                disabled={!name || save.isPending}
              >
                Salvar Brand Kit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kits.data?.map(kit => (
          <Card key={kit.id} className="border-0 bg-white shadow-sm">
            <CardContent className="flex items-center gap-4 p-4">
              <div
                className="h-12 w-12 rounded-xl shadow-inner"
                style={{ backgroundColor: kit.primaryColor ?? "#00d7ff" }}
              />
              <div className="flex-1">
                <p className="font-medium text-slate-900">{kit.name}</p>
                <p className="text-xs text-slate-500">{kit.primaryColor}</p>
              </div>
              {kit.isDefault && (
                <Badge className="bg-emerald-50 text-emerald-700">Padrão</Badge>
              )}
            </CardContent>
          </Card>
        ))}
        {!kits.data?.length && !isAdding && (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-200 p-12 text-center">
            <Palette className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 font-medium text-slate-800">Nenhum Brand Kit</p>
            <p className="mt-1 text-sm text-slate-500">
              Crie estilos personalizados para seus cortes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
