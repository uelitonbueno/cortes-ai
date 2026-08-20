# Notas frontend (para documentação dos menus)

## Navegação (DashboardLayout.tsx)

Menu lateral (sidebar redimensionável, 200–480px, persistido em localStorage, colapsável a ícones):

1. Visão geral (/) — hero "PIPELINE INTELIGENTE", CTAs "Adicionar vídeo" e "Abrir revisão"; 4 cards: Vídeos / Em revisão / Agendados / Publicados; "Atividade do pipeline" (últimos 6 jobs) + "Saúde operacional" (armazenamento seguro, falhas recentes).
2. Vídeos (/videos) — registro de vídeo (upload base64 até 6MB), lista com progresso por estado, detalhe via /videos/:id.
3. Revisão (/review) — candidatos pendentes ordenados por finalScore; aprovar/rejeitar com motivo, editar título sugerido; aprovação cria clip (rendering) + jobs metadata (llm) e thumbnail (cpu).
4. Publicações (/publications) — lista de publicações por plataforma, status scheduled/published.
5. Analytics (/analytics) — views/likes/comments/shares/retention + recalibração de score.
6. Configurações (/settings) — seção Integrações: YouTube/TikTok/Instagram com endpoint + token (mascarado), publicação desligada por padrão.
   Sidebar: avatar do usuário + menu dropdown "Sair" (logout). Mobile: barra superior com toggle e título do menu ativo.

## PipelineDetail (/videos/:id)

- Botões: Atualizar / Gerar cortes / Reprocessar / Cancelar; auto-refresh a cada 5s quando em execução.
- 4 etapas visuais: 01 Normalização (CPU) 02 Transcrição (GPU) 03 Detecção de highlights (LLM) 04 Renderização (CPU), com estados pendente/executando/concluída/falhou.
- Card de artefatos com preview via URL assinada (vídeo/áudio/imagem).
- Histórico de tarefas (jobs): fila, status, retry count, erro.

## Pipeline (server/db.ts start)

stages: ingest(pipeline.cpu, queued) → transcribe(pipeline.gpu, cancelled inicial) → detect_highlights(pipeline.llm, cancelled) → render(pipeline.cpu, cancelled); vídeo vai a "normalizing". Callback do worker atualiza job + estado do vídeo (mapa: ingest running→normalizing, succeeded→transcribing; transcribe running→transcribing, succeeded→detecting; detect_highlights running→detecting, succeeded→rendering; render running→rendering, succeeded→awaiting_review).
completeIngestCallback: idempotente (job succeeded → duplicate), registra artefatos normalized_video e audio, vídeo→transcribing.
updateCandidateReview (aprovar): cria clip (status rendering) + jobs metadata:clip:{id} e thumbnail:clip:{id}.
cancel: jobs→cancelled, vídeo→failed.
createSourceVideo: registra vídeo + job ingest queued.

## Score/IA

- generateClipMetadata (ai.generateMetadata): titles, description, hashtags, thumbnailText (schema JSON).
- detectHighlightsPreview: candidatos com start/end/category/viral_score/hook/reasoning/title.
- combinedHighlightScore: llm*0.6 + audio*0.2 + chat\*0.2, normalizado 0–100.
- splitTranscriptWindows: 900s janela, 120s overlap. removeOverlappingCandidates: IoU>0.3.
- ASS karaoke: \k centissegundos por palavra.

## Testes

27 testes passando (7 arquivos), typecheck limpo, build ok.

## Melhorias aplicadas

- .env.example completo
- vitest.setup.ts global (PIPELINE_CALLBACK_TOKEN default), setupFiles na vitest.config
- queue.redis.test.ts: skip limpo, testes de dedup e motivo REDIS_URL_not_configured
- routers.feature.test.ts: mock storagePut/storageGetSignedUrl
