import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  Eye,
  Heart,
  MessageCircle,
  Repeat2,
  Target,
} from "lucide-react";

export default function Analytics() {
  const query = trpc.analytics.summary.useQuery();
  const data = (query.data as any) ?? {
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    retention: 0,
    publications: 0,
  };
  const cards = [
    {
      label: "Visualizações",
      value: data.views.toLocaleString("pt-BR"),
      icon: Eye,
    },
    {
      label: "Curtidas",
      value: data.likes.toLocaleString("pt-BR"),
      icon: Heart,
    },
    {
      label: "Comentários",
      value: data.comments.toLocaleString("pt-BR"),
      icon: MessageCircle,
    },
    {
      label: "Compartilhamentos",
      value: data.shares.toLocaleString("pt-BR"),
      icon: Repeat2,
    },
  ];
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-7">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-700">
            Performance
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            Analytics
          </h1>
          <p className="mt-2 text-slate-500">
            Acompanhe o desempenho publicado e prepare o score para aprender com
            os resultados.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(card => (
            <Card
              key={card.label}
              className="border-0 bg-white shadow-sm shadow-slate-200/70"
            >
              <CardContent className="p-5">
                <card.icon className="h-5 w-5 text-cyan-600" />
                <p className="mt-5 text-sm text-slate-500">{card.label}</p>
                <p className="mt-1 text-3xl font-semibold text-slate-900">
                  {card.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Card className="border-0 bg-white shadow-sm shadow-slate-200/70">
            <CardHeader>
              <CardTitle className="text-lg">Retenção média</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4">
                <span className="text-5xl font-semibold tracking-tight text-slate-900">
                  {data.retention.toFixed(1)}%
                </span>
                <Badge className="mb-2 bg-slate-100 text-slate-600 hover:bg-slate-100">
                  {data.publications} publicações
                </Badge>
              </div>
              <div className="mt-8 h-44 rounded-2xl bg-gradient-to-t from-cyan-50 to-white p-4">
                <div className="flex h-full items-end gap-2">
                  {[28, 42, 36, 58, 44, 65, 52, 72, 61, 79, 68, 85].map(
                    (height, index) => (
                      <div
                        key={index}
                        className="flex-1 rounded-t-md bg-cyan-400/70"
                        style={{ height: `${height}%` }}
                      />
                    )
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 bg-[#f5f8fb] shadow-sm shadow-slate-200/70">
            <CardHeader>
              <CardTitle className="text-lg">Loop de aprendizado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-cyan-100 p-2 text-cyan-700">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-slate-800">
                    Calibração preparada
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Quando houver volume de publicações, o sistema cruzará
                    score, retenção e aprovação para recalibrar os pesos dos
                    sinais.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
