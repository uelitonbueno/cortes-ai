import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  CheckCircle2,
  Film,
  Loader2,
  PackageOpen,
  Play,
  RefreshCw,
  Square,
} from "lucide-react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

export default function PipelineDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const utils = trpc.useUtils();
  const detail = trpc.videos.detail.useQuery(
    { id },
    { enabled: Number.isInteger(id) && id > 0, refetchInterval: 5000 }
  );
  const start = trpc.videos.start.useMutation({
    onSuccess: () => {
      toast.success("Geração de cortes iniciada");
      utils.videos.detail.invalidate({ id });
    },
    onError: error => toast.error(error.message),
  });
  const retry = trpc.videos.retry.useMutation({
    onSuccess: () => {
      toast.success("Pipeline reenfileirado");
      utils.videos.detail.invalidate({ id });
    },
    onError: error => toast.error(error.message),
  });
  const cancel = trpc.videos.cancel.useMutation({
    onSuccess: () => {
      toast.success("Pipeline cancelado");
      utils.videos.detail.invalidate({ id });
    },
    onError: error => toast.error(error.message),
  });
  const pipeline = detail.data;
  const busy = start.isPending || retry.isPending || cancel.isPending;
  const status = pipeline?.video.status;
  const canStart = status === "uploaded";
  const canRetry = status === "failed";
  const canCancel = Boolean(
    pipeline && !["published", "failed"].includes(status ?? "")
  );
  const stages = [
    { key: "ingest", label: "Normalização", status: "normalizing" },
    { key: "transcribe", label: "Transcrição", status: "transcribing" },
    { key: "detect_highlights", label: "Highlights", status: "detecting" },
    { key: "render", label: "Renderização", status: "rendering" },
  ];
  const stageStatus = (key: string) =>
    pipeline?.jobs.find(job => job.jobType === key)?.status ?? "queued";
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <Link
          href="/videos"
          className="inline-flex items-center text-sm font-medium text-cyan-700 hover:text-cyan-900"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para vídeos
        </Link>
        {detail.isLoading ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando pipeline...
          </div>
        ) : !pipeline ? (
          <Card className="border-0">
            <CardContent className="p-10 text-center text-slate-500">
              Vídeo não encontrado.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-700">
                  Auditoria do pipeline
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                  {pipeline.video.title}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{pipeline.video.status}</Badge>
                  <span className="text-sm text-slate-500">
                    versão {pipeline.video.processingVersion}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => detail.refetch()}
                  variant="outline"
                  disabled={busy}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Atualizar
                </Button>
                {canStart && (
                  <Button onClick={() => start.mutate({ id })} disabled={busy}>
                    <Play className="mr-2 h-4 w-4" />
                    Gerar cortes
                  </Button>
                )}
                {canRetry && (
                  <Button onClick={() => retry.mutate({ id })} disabled={busy}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reprocessar
                  </Button>
                )}
                {canCancel && (
                  <Button
                    onClick={() => cancel.mutate({ id })}
                    disabled={busy}
                    variant="destructive"
                  >
                    <Square className="mr-2 h-4 w-4" />
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-950">
              {canStart
                ? "O vídeo foi recebido. Clique em Gerar cortes para iniciar normalização, transcrição, detecção de highlights e renderização."
                : canRetry
                  ? "O pipeline encontrou uma falha. Reprocesse para reenfileirar as etapas."
                  : "O pipeline está sendo acompanhado automaticamente; esta tela atualiza a cada 5 segundos."}
            </div>
            <Card className="border-0 bg-white shadow-sm shadow-slate-200/70">
              <CardHeader>
                <CardTitle className="text-lg">Progresso da geração</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-4">
                  {stages.map((stage, index) => {
                    const current = stageStatus(stage.key);
                    const done =
                      current === "succeeded" ||
                      ([
                        "transcribing",
                        "detecting",
                        "rendering",
                        "awaiting_review",
                        "completed",
                      ].includes(status ?? "") &&
                        stages.findIndex(item => item.status === status) >
                          index);
                    const failed = current === "failed";
                    return (
                      <div
                        key={stage.key}
                        className={`rounded-2xl border p-4 ${failed ? "border-rose-200 bg-rose-50" : done ? "border-emerald-200 bg-emerald-50" : current === "running" ? "border-cyan-200 bg-cyan-50" : "border-slate-100 bg-slate-50"}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            0{index + 1}
                          </span>
                          <span className="text-xs font-medium text-slate-500">
                            {failed
                              ? "Falhou"
                              : done
                                ? "Concluída"
                                : current === "running"
                                  ? "Executando"
                                  : "Pendente"}
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-slate-800">
                          {stage.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <Card className="border-0 bg-white shadow-sm shadow-slate-200/70">
                <CardHeader>
                  <CardTitle className="text-lg">
                    Artefatos e preview seguro
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pipeline.artifacts.length ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {pipeline.artifacts.map(artifact => (
                        <div
                          key={artifact.id}
                          className="overflow-hidden rounded-2xl border border-slate-100"
                        >
                          <div className="aspect-video bg-slate-900">
                            {artifact.mimeType.startsWith("video/") ? (
                              <video
                                controls
                                className="h-full w-full object-contain"
                                src={artifact.signedUrl}
                              />
                            ) : artifact.mimeType.startsWith("image/") ? (
                              <img
                                src={artifact.signedUrl}
                                alt={artifact.artifactType}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-slate-500">
                                <PackageOpen className="h-8 w-8" />
                              </div>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="text-sm font-medium text-slate-800">
                              {artifact.artifactType}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              URL temporária assinada
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center">
                      <Film className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-3 font-medium text-slate-800">
                        Nenhum artefato disponível
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        O preview aparecerá quando o worker registrar os
                        arquivos no armazenamento.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="border-0 bg-white shadow-sm shadow-slate-200/70">
                <CardHeader>
                  <CardTitle className="text-lg">
                    Histórico de tarefas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pipeline.jobs.length ? (
                    <div className="space-y-3">
                      {pipeline.jobs.map(job => (
                        <div
                          key={job.id}
                          className="flex items-start gap-3 rounded-2xl border border-slate-100 p-3"
                        >
                          <CheckCircle2
                            className={`mt-0.5 h-4 w-4 ${job.status === "failed" ? "text-rose-500" : job.status === "succeeded" ? "text-emerald-500" : "text-slate-400"}`}
                          />
                          <div>
                            <p className="text-sm font-medium capitalize text-slate-800">
                              {job.jobType.replaceAll("_", " ")}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {job.queueName} · {job.status} · retry{" "}
                              {job.retryCount}
                            </p>
                            {job.errorMessage && (
                              <p className="mt-2 text-xs text-rose-600">
                                {job.errorMessage}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Nenhuma tarefa registrada.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
