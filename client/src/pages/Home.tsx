import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  ArrowRight,
  CircleAlert,
  Film,
  ListVideo,
  Radio,
  Sparkles,
  UploadCloud,
} from "lucide-react";

const statusLabels: Record<string, string> = {
  queued: "Na fila",
  running: "Executando",
  succeeded: "Concluído",
  failed: "Falhou",
  cancelled: "Cancelado",
};

export default function Home() {
  const overview = trpc.dashboard.overview.useQuery();
  const jobs = trpc.dashboard.jobs.useQuery();
  const stats = overview.data ?? {
    videos: 0,
    review: 0,
    scheduled: 0,
    published: 0,
    failedJobs: 0,
  };
  const cards = [
    {
      label: "Vídeos processados",
      value: stats.videos,
      icon: Film,
      tone: "text-cyan-600 bg-cyan-50",
    },
    {
      label: "Aguardando revisão",
      value: stats.review,
      icon: ListVideo,
      tone: "text-amber-600 bg-amber-50",
    },
    {
      label: "Agendados",
      value: stats.scheduled,
      icon: Radio,
      tone: "text-violet-600 bg-violet-50",
    },
    {
      label: "Publicados",
      value: stats.published,
      icon: Sparkles,
      tone: "text-emerald-600 bg-emerald-50",
    },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="relative overflow-hidden rounded-3xl bg-[#102a43] px-7 py-8 text-white shadow-xl shadow-slate-200/60 md:px-10 md:py-10">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute bottom-0 right-24 h-32 w-32 rounded-full bg-violet-400/20 blur-2xl" />
          <div className="relative max-w-2xl">
            <Badge className="mb-4 border-white/15 bg-white/10 text-cyan-100 hover:bg-white/10">
              PIPELINE INTELIGENTE
            </Badge>
            <h1 className="max-w-xl text-3xl font-semibold tracking-tight md:text-4xl">
              Transforme vídeos longos em cortes que merecem publicação.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 md:text-base">
              O Cortes AI organiza ingestão, transcrição, seleção, renderização,
              revisão e publicação em um fluxo rastreável.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/videos">
                <Button className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Adicionar vídeo
                </Button>
              </Link>
              <Link href="/review">
                <Button
                  variant="outline"
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                >
                  Abrir revisão <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(card => (
            <Card
              key={card.label}
              className="border-0 bg-white shadow-sm shadow-slate-200/70"
            >
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-slate-500">{card.label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                    {card.value}
                  </p>
                </div>
                <div className={`rounded-2xl p-3 ${card.tone}`}>
                  <card.icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Card className="border-0 bg-white shadow-sm shadow-slate-200/70">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg text-slate-900">
                  Atividade do pipeline
                </CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Últimos jobs registrados no sistema.
                </p>
              </div>
              <Link
                href="/videos"
                className="text-sm font-medium text-cyan-700 hover:text-cyan-900"
              >
                Ver vídeos
              </Link>
            </CardHeader>
            <CardContent>
              {jobs.isLoading ? (
                <div className="space-y-3">
                  <Progress value={38} className="h-2" />
                  <p className="text-sm text-slate-500">
                    Carregando atividade...
                  </p>
                </div>
              ) : jobs.data?.length ? (
                <div className="space-y-3">
                  {jobs.data.slice(0, 6).map(job => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {job.jobType.replaceAll("_", " ")}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Fila {job.queueName} · tentativa {job.retryCount + 1}
                        </p>
                      </div>
                      <Badge
                        variant={
                          job.status === "failed" ? "destructive" : "secondary"
                        }
                      >
                        {statusLabels[job.status] ?? job.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                  <Sparkles className="mx-auto h-7 w-7 text-cyan-500" />
                  <p className="mt-3 font-medium text-slate-800">
                    Nenhum job iniciado
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Adicione seu primeiro vídeo para ativar o pipeline.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border-0 bg-[#f5f8fb] shadow-sm shadow-slate-200/70">
            <CardHeader>
              <CardTitle className="text-lg text-slate-900">
                Saúde operacional
              </CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Sinais que merecem atenção agora.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl bg-white p-4">
                <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                  <Radio className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    Armazenamento seguro
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Artefatos serão mantidos por chave de objeto e servidos por
                    URLs temporárias.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl bg-white p-4">
                <div className="rounded-xl bg-amber-50 p-2 text-amber-600">
                  <CircleAlert className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    Falhas recentes
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {stats.failedJobs} job(s) falharam. O retry automático será
                    conectado aos workers na próxima etapa.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}
