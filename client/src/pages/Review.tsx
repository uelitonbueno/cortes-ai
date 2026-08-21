import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  Check,
  Clock3,
  Edit3,
  Film,
  X,
  Layers,
  Sparkles,
  CheckSquare,
  Square,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const rejectionReasons = [
  "Fora de contexto",
  "Baixa qualidade",
  "Duplicado",
  "Direitos autorais",
  "Outro",
];

export default function Review() {
  const candidates = trpc.review.list.useQuery();
  const brandKits = trpc.brandKits.list.useQuery();
  const utils = trpc.useUtils();
  
  const update = trpc.review.update.useMutation({
    onSuccess: () => {
      toast.success("Revisão registrada");
      utils.review.list.invalidate();
      utils.dashboard.overview.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const bulkApprove = trpc.review.bulkApprove.useMutation({
    onSuccess: () => {
      toast.success("Edição em massa processada com sucesso");
      setSelectedIds([]);
      utils.review.list.invalidate();
      utils.dashboard.overview.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const [editing, setEditing] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState(rejectionReasons[0]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedBrandKit, setSelectedBrandKit] = useState<string>("default");

  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkApprove = () => {
    if (selectedIds.length === 0) return;
    bulkApprove.mutate({
      candidateIds: selectedIds,
      brandKitId: selectedBrandKit === "default" ? undefined : Number(selectedBrandKit),
    });
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-700">
              Controle editorial
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              Fila de revisão
            </h1>
            <p className="mt-2 text-slate-500">
              A IA sugere. Você decide o que representa o seu canal.
            </p>
          </div>
          {selectedIds.length > 0 && (
            <Card className="border-cyan-100 bg-cyan-50 p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-cyan-900">
                  <Sparkles className="h-5 w-5 text-cyan-600" />
                  <span className="font-semibold">
                    {selectedIds.length} selecionados
                  </span>
                </div>
                <Select
                  value={selectedBrandKit}
                  onValueChange={setSelectedBrandKit}
                >
                  <SelectTrigger className="w-48 border-cyan-200 bg-white">
                    <SelectValue placeholder="Brand Kit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Padrão do Sistema</SelectItem>
                    {brandKits.data?.map(kit => (
                      <SelectItem key={kit.id} value={String(kit.id)}>
                        {kit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleBulkApprove}
                  disabled={bulkApprove.isPending}
                  className="bg-cyan-600 text-white hover:bg-cyan-700"
                >
                  <Layers className="mr-2 h-4 w-4" />
                  Edição em Massa
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds([])}
                  className="text-slate-500"
                >
                  Cancelar
                </Button>
              </div>
            </Card>
          )}
        </div>
        <Card className="border-0 bg-white shadow-sm shadow-slate-200/70">
          <CardHeader>
            <CardTitle className="text-lg">Candidatos pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            {candidates.isLoading ? (
              <p className="text-sm text-slate-500">Carregando candidatos...</p>
            ) : candidates.data?.length ? (
              <div className="space-y-4">
                {candidates.data.map(candidate => (
                  <div
                    key={candidate.id}
                    className="grid gap-5 rounded-2xl border border-slate-100 p-4 md:grid-cols-[220px_1fr_auto]"
                  >
                    <div className="relative group aspect-video flex items-center justify-center rounded-xl bg-slate-900 text-slate-500 overflow-hidden">
                      <Film className="h-8 w-8" />
                      <div 
                        className={`absolute inset-0 cursor-pointer flex items-center justify-center transition-colors ${selectedIds.includes(candidate.id) ? 'bg-cyan-500/20' : 'bg-transparent group-hover:bg-black/40'}`}
                        onClick={() => toggleSelect(candidate.id)}
                      >
                        {selectedIds.includes(candidate.id) ? (
                          <CheckSquare className="h-8 w-8 text-cyan-400" />
                        ) : (
                          <Square className="h-8 w-8 text-white/40 opacity-0 group-hover:opacity-100" />
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-cyan-50 text-cyan-800 hover:bg-cyan-50">
                          Score {candidate.finalScore}/100
                        </Badge>
                        <Badge variant="outline">{candidate.category}</Badge>
                        <span className="text-xs text-slate-500">
                          <Clock3 className="mr-1 inline h-3 w-3" />
                          {Math.round(
                            (candidate.endTimeMs - candidate.startTimeMs) / 1000
                          )}
                          s
                        </span>
                      </div>
                      <h2 className="mt-3 text-base font-semibold text-slate-900">
                        {candidate.suggestedTitle || "Título ainda não gerado"}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        {candidate.reasoning || "Sem justificativa registrada."}
                      </p>
                      {editing === candidate.id && (
                        <div className="mt-4 space-y-3">
                          <Input
                            value={title}
                            onChange={event => setTitle(event.target.value)}
                            placeholder="Título do corte"
                          />
                          <Textarea
                            value={reason}
                            onChange={event => setReason(event.target.value)}
                            placeholder="Motivo de rejeição, se aplicável"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-row gap-2 md:flex-col">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() =>
                          update.mutate({
                            id: candidate.id,
                            status: "approved",
                            suggestedTitle:
                              editing === candidate.id
                                ? title
                                : (candidate.suggestedTitle ?? undefined),
                          })
                        }
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-rose-200 text-rose-700 hover:bg-rose-50"
                        onClick={() =>
                          update.mutate({
                            id: candidate.id,
                            status: "rejected",
                            rejectionReason: reason,
                          })
                        }
                      >
                        <X className="mr-2 h-4 w-4" />
                        Rejeitar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(
                            editing === candidate.id ? null : candidate.id
                          );
                          setTitle(candidate.suggestedTitle ?? "");
                        }}
                      >
                        <Edit3 className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center">
                <Check className="mx-auto h-8 w-8 text-emerald-500" />
                <p className="mt-3 font-medium text-slate-800">
                  Tudo revisado por enquanto
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Novos candidatos aparecerão aqui quando a detecção de
                  highlights terminar.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
