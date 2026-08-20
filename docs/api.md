# Cortes AI — Contrato da API (tRPC)

**Autor:** Manus AI · **Versão documentada:** 1.0

Todas as rotas do backend vivem em `server/routers.ts` sob um router tRPC 11 com validação Zod 4. Toda rota protegida (`protectedProcedure`) exige sessão autenticada e filtra dados pelo `ownerId` do contexto — um usuário nunca vê ou altera dados de outro. A tabela abaixo lista cada procedimento com entrada, saída e efeito colateral.

## Router `videos`

| Procedimento | Entrada                                                                                            | Saída                                                   | Efeito                                                                                                 |
| ------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `register`   | `title`, `sourceType` (upload/youtube/twitch/live), `originalUrl?`, `idempotencyKey` (8–128 chars) | `source_video` criado                                   | Registra vídeo `uploaded` + job `ingest` em fila (idempotente)                                         |
| `upload`     | `title`, `fileName`, `mimeType` (video/\*), `contentBase64` (≤ 8 MB), `idempotencyKey`             | `{ source, artifact, queue }`                           | Armazena binário sanitizado (≤ 6 MB efetivos), artefato `raw_video`, enfileira ingest com URL assinada |
| `start`      | `id`                                                                                               | pipeline criado (`normalizing`, 4 stages)               | Cria jobs ingest/transcribe/detect/render com idempotência; lança erro se o artefato bruto faltar      |
| `cancel`     | `id`                                                                                               | `{ videoId, status: "failed" }`                         | Jobs → `cancelled`, vídeo → `failed`                                                                   |
| `retry`      | `id`                                                                                               | pipeline recriado                                       | Reexecuta `start` (idempotente por estágio)                                                            |
| `detail`     | `id`                                                                                               | vídeo + jobs + artefatos (com `signedUrl`) + candidatos | Auditoria completa; artefatos recebem URL temporária assinada                                          |
| `list`       | —                                                                                                  | até 50 vídeos                                           | Ordenado por criação desc.                                                                             |

## Router `review`

| Procedimento | Entrada                                                                                  | Saída                  | Efeito                                                                      |
| ------------ | ---------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------- |
| `list`       | —                                                                                        | candidatos `candidate` | Ordenado por `finalScore` desc. (até 50)                                    |
| `update`     | `id`, `status` (approved/rejected), `rejectionReason?` (≤ 80), `suggestedTitle?` (≤ 255) | candidato atualizado   | Aprovação cria clip `rendering` + jobs `metadata` (LLM) e `thumbnail` (CPU) |

## Router `publications`

| Procedimento | Saída                                   |
| ------------ | --------------------------------------- |
| `list`       | publicações do owner                    |
| `platforms`  | enum `["youtube","tiktok","instagram"]` |

## Router `integrations`

| Procedimento | Entrada                                                                                    | Saída                                               | Efeito                     |
| ------------ | ------------------------------------------------------------------------------------------ | --------------------------------------------------- | -------------------------- |
| `list`       | —                                                                                          | integrações por plataforma, `accessToken` mascarado | —                          |
| `save`       | `platform`, `accessToken?` (≤ 10.000), `publishEndpoint?` (URL), `enabled` (default false) | integração persistida, token mascarado              | Upsert protegido por owner |

## Router `alerts` e `pipeline`

| Procedimento           | Efeito                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `pipeline.reportEvent` | Cria `pipeline_alert` (review_ready → info; score_anomaly → warning; publication_failed/pipeline_failed → critical) e notifica o owner |
| `alerts.list`          | Lista alertas do owner                                                                                                                 |
| `alerts.markRead`      | Marca alerta como lido                                                                                                                 |

## Router `analytics`

| Procedimento        | Saída                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| `summary`           | `{ views, likes, comments, shares, retention, publications }` somados |
| `latestCalibration` | pesos `llm/audio/chat`, `sampleSize`, `modelVersion`, data            |

## Router `ai`

| Procedimento              | Entrada                                                   | Saída                                                                                           |
| ------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `generateMetadata`        | `transcript` (20–30.000), `category`                      | `{ titles[], description, hashtags[], thumbnailText }` com schema JSON validado                 |
| `detectHighlightsPreview` | `transcriptChunk` (20–30.000), `language` (default pt-BR) | `{ candidates[] }` com start, end, category, viral_score, hook_text, reasoning, suggested_title |

## Callback dos workers

| Endpoint                      | Autenticação                                | Entrada                                                                                                                                                                                                                                                               | Saída                                                                                              |
| ----------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `POST /api/pipeline/callback` | header `x-pipeline-token` (401 se inválido) | `jobId`, `sourceVideoId`, `ownerId`, `jobType` (ingest/transcribe/detect_highlights/render), `status` (running/succeeded/failed), `idempotencyKey` (8–160), `errorMessage?`; no sucesso de ingest: `normalizedBase64`, `audioBase64`, `normalizedBytes`, `audioBytes` | `{ ok, updated, status }`; em ingest bem-sucedido persiste `normalized_video` e `audio` no storage |

O callback é idempotente: se o job já está `succeeded`, retorna `{ duplicate: true }` sem reprocessar. Payloads inválidos retornam 400 com a mensagem da validação Zod.

## Fila Redis

`enqueueJob({ queue, payload, idempotencyKey })` usa `SET cortez:queue:idempotency:{key} EX 86400 NX` antes do `RPUSH`. Sem `REDIS_URL` configurado, retorna `{ queued: false, reason: "REDIS_URL_not_configured" }` sem falhar. Chaves de idempotência seguem os padrões `ingest:{videoId}:{registerKey}`, `{stage}:{videoId}` e `metadata:clip:{clipId}` / `thumbnail:clip:{clipId}`.

## Erros

Erros de domínio são lançados como `Error` com mensagem em português (ex.: "Artefato bruto não encontrado para iniciar a ingestão", "Arquivo acima do limite da primeira versão") e propagados pelo tRPC como `TRPCError` com status adequado.
