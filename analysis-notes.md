# Notas de análise — Cortes AI (para documentação)

## Estrutura

- client/ — React + Vite + TypeScript + Tailwind 4, páginas: Home, Videos, PipelineDetail, Review, Publications, Analytics, SettingsIntegrations
- server/ — tRPC: routers.ts (videos.register/upload/start/cancel/retry/detail, review.list/update, publications.list/platforms, pipeline.reportEvent, integrations.list/save, alerts, analytics, ai.generateMetadata/detectHighlightsPreview)
- server/\_core/ — auth, cookies, db helpers, env, llm, notification, oauth, sdk, storageProxy, trpc, vite, voiceTranscription
- server/db.ts — helpers Drizzle (dashboard, listas, getPipelineDetail, alerts, integrations masking, analytics)
- server/pipelineCallback.ts — POST /api/pipeline/callback autenticado por x-pipeline-token; ingere normalized+audio base64
- server/queue.ts — enqueueJob Redis (pipeline.cpu/.gpu/.llm/.publishing/.analytics) com idempotência via chave EX 86400
- server/platforms.ts — publishers com estratégia: CredentialedPlatformPublisher bloqueia se credenciais não configuradas
- shared/pipeline.ts — contratos: PIPELINE_STATES, transições, score combinado, janelas, removeOverlappingCandidates, ASS karaoke, render vertical
- shared/content.ts, shared/analytics.ts, shared/storage.ts — contratos pequenos
- drizzle/ — 6 migrações MySQL (source_videos, media_artifacts, processing_jobs, transcripts, clip_candidates, clips, publications, metrics, score_calibrations, pipeline_alerts, integration_settings)
- workers/cpu/ — ingest_worker.py (FFmpeg) + thumbnail_worker.py, Dockerfile
- workers/python/ — transcription_worker.py (faster-whisper), Dockerfile + requirements.txt
- scripts/ — requeue_cpu_ingest.mjs, inspect_cpu_queue.py

## Pontos fortes

- Contratos compartilhados typed, idempotência em jobs e upload, sanitização de nomes ASCII, masking de segredos, transições de estado validadas, score com pesos + pós-processamento de sobreposição.

## Pontos a melhorar (best practices)

1. docs-v1.md descreve projeto mas não há README.md — adicionar README completo.
2. ingest_worker.py não tem retry com backoff, não limpa chave idempotência após sucesso (chave existe mas existe é setado só no sucesso; falta ack confiável — brpop + ack após callback ok: ok na prática, mas sem nack).
3. ingest_worker.py: idempotência verificada via redis.exists, mas chave da aplicação usa prefixo `cortes:queue:idempotency:` e worker usa `cortes:idempotency:` — verificar consistência.
4. queue.redis.test.ts só testa se REDIS_URL configurado; sem Redis, teste passa trivialmente (skip sem mensagem clara).
5. ingest_worker retorna base64 de todo o arquivo (até 6MB?) — ok dentro do limite.
6. Falta Docker Compose para orquestrar app + redis + workers.
7. Falta .env.example documentando variáveis.
8. Falta CONTRIBUTING.md / fluxo de commit.
9. platform-connectors.ts tem conteúdo de adaptador YouTube com body.id — verificar.
10. workers/python/README.md existe — manter.
