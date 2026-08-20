import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Film, Plus, UploadCloud, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

const labels: Record<string, string> = { uploaded: "Recebido", normalizing: "Normalizando", transcribing: "Transcrevendo", detecting: "Detectando highlights", rendering: "Renderizando", awaiting_review: "Aguardando revisão", completed: "Concluído", failed: "Falhou" };

export default function Videos() {
  const videos = trpc.videos.list.useQuery();
  const utils = trpc.useUtils();
  const register = trpc.videos.register.useMutation({ onSuccess: () => { toast.success("Vídeo registrado no pipeline"); utils.videos.list.invalidate(); utils.dashboard.overview.invalidate(); setTitle(""); }, onError: error => toast.error(error.message) });
  const [title, setTitle] = useState("");
  return <DashboardLayout><div className="mx-auto max-w-7xl space-y-6"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-700">Ingestão</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Vídeos fonte</h1><p className="mt-2 text-slate-500">Registre vídeos longos e acompanhe o processamento de ponta a ponta.</p></div></div><Card className="border-0 bg-[#102a43] text-white shadow-sm shadow-slate-200/70"><CardContent className="grid gap-5 p-6 md:grid-cols-[1fr_auto] md:items-end"><div><div className="flex items-center gap-2 text-cyan-200"><UploadCloud className="h-4 w-4" /><span className="text-sm font-medium">Novo vídeo</span></div><Label htmlFor="video-title" className="mt-4 block text-slate-300">Nome de identificação</Label><Input id="video-title" value={title} onChange={event => setTitle(event.target.value)} placeholder="Ex.: Podcast episódio 12" className="mt-2 max-w-xl border-white/15 bg-white/10 text-white placeholder:text-slate-400" /></div><Button disabled={title.trim().length < 2 || register.isPending} onClick={() => register.mutate({ title: title.trim(), sourceType: "upload", idempotencyKey: `upload-${Date.now()}` })} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"><Plus className="mr-2 h-4 w-4" />Registrar vídeo</Button></CardContent></Card><Card className="border-0 bg-white shadow-sm shadow-slate-200/70"><CardHeader><CardTitle className="text-lg">Histórico de ingestão</CardTitle></CardHeader><CardContent>{videos.isLoading ? <p className="text-sm text-slate-500">Carregando vídeos...</p> : videos.data?.length ? <div className="space-y-3">{videos.data.map(video => <div key={video.id} className="flex flex-col gap-3 rounded-2xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="rounded-xl bg-slate-100 p-3 text-slate-500"><Film className="h-5 w-5" /></div><div><p className="font-medium text-slate-800">{video.title}</p><p className="mt-1 text-xs text-slate-500">{video.sourceType} · versão {video.processingVersion}</p></div></div><div className="flex items-center gap-2"><Badge variant={video.status === "failed" ? "destructive" : "secondary"}>{labels[video.status] ?? video.status}</Badge><Link href={`/videos/${video.id}`} className="rounded-lg p-2 text-cyan-700 hover:bg-cyan-50" aria-label={`Abrir detalhe de ${video.title}`}><ArrowRight className="h-4 w-4" /></Link></div></div>)}</div> : <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center"><Film className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-medium text-slate-800">Nenhum vídeo registrado</p><p className="mt-1 text-sm text-slate-500">A primeira versão registra a fonte e prepara o contrato para upload binário e workers.</p></div>}</CardContent></Card></div></DashboardLayout>;
}
