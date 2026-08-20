# Cortes AI — Operações e Diagnóstico

**Autor:** Manus AI · **Versão documentada:** 1.0

## Variáveis de ambiente

Todas as variáveis estão listadas em `.env.example`. As mais relevantes para operação são:

| Variável                                                      | Obrigatória        | Papel                                                                                                  |
| ------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                                                | Sim (funcional)    | Conexão MySQL do Drizzle; sem ela as rotas retornam vazias, não erros                                  |
| `REDIS_URL`                                                   | Recomendada        | Filas do pipeline; sem ela `enqueueJob` retorna `queued: false` com `reason: REDIS_URL_not_configured` |
| `PIPELINE_CALLBACK_TOKEN`                                     | Sim (para workers) | Autentica `POST /api/pipeline/callback`; sem ela todo callback é rejeitado (401)                       |
| `PUBLIC_APP_URL`                                              | Recomendada        | URL pública usada pelos workers para chamar o callback                                                 |
| `BUILT_IN_FORGE_API_URL` / `BUILT_IN_FORGE_API_KEY`           | Sim (upload real)  | Presign para S3; sem elas upload e preview assinado falham                                             |
| `YOUTUBE/TIKTOK/INSTAGRAM_ACCESS_TOKEN` e `_PUBLISH_ENDPOINT` | Futuro             | Publicação automática (hoje desligada por padrão)                                                      |
| `JWT_SECRET`, `OAUTH_SERVER_URL`, `OWNER_OPEN_ID`             | Sim (auth)         | Fornecidas pelo ambiente de runtime                                                                    |

O primeiro login atribui automaticamente o papel `admin` ao `openId` configurado em `OWNER_OPEN_ID`; demais usuários recebem `user`.

## Como validar o sistema

```bash
pnpm install       # dependências
pnpm check         # typecheck — deve passar sem erros
pnpm test          # 27 testes em 7 arquivos — todos devem passar
pnpm build         # client + servidor em dist/
```

Os testes rodam em qualquer ambiente: o setup global (`server/__tests__/vitest.setup.ts`) fornece `PIPELINE_CALLBACK_TOKEN` padrão, o teste de Redis faz skip limpo quando `REDIS_URL` não existe, e as rotas dependem de mocks explícitos (`vi.mock("./db")`, `vi.mock("./storage")`) nos testes de features. O teste de deduplicação (`queue.redis.test.ts`) exige Redis real apenas quando a variável está configurada.

## Diagnóstico de um pipeline parado

O `todo.md` registra a pendência ativa de diagnóstico. O roteiro recomendado é:

1. **Job**: `GET jobs.list` ou SQL `SELECT id, jobType, queueName, status, retryCount, error_message FROM processing_jobs WHERE sourceVideoId = :id ORDER BY createdAt DESC;` — o job de ingestão deve estar `queued`.
2. **Fila**: `scripts/inspect_cpu_queue.py` — deve haver pelo menos uma tarefa; a fila vazia indica que o enfileiramento falhou (ausência de `REDIS_URL` ou chave de idempotência já existente).
3. **Worker**: verificar se o container `cortes-ingest` está rodando e consumindo `pipeline.cpu`; logs do worker mostram a validação Pydantic e a chamada ao callback.
4. **Callback**: o token do worker deve bater com `PIPELINE_CALLBACK_TOKEN`; payloads inválidos retornam 400 com a mensagem Zod, e tokens errados retornam 401.
5. **Reenfileirar**: `tsx scripts/requeue_cpu_ingest.mjs <ownerId> <videoId>` recria a tarefa com chave nova (`ingest:{videoId}:worker-retry`) após limpar a fila local.
6. **Artefatos**: após o callback de sucesso, `GET videos.detail` deve listar `normalized_video` e `audio` com `signedUrl`.

## Limitações conscientes da V1

O upload é limitado a 6 MB porque o binário viaja em base64 pela API web; a normalização real, a extração de áudio e o render definitivo dependem dos workers externos; a transcrição por palavra exige o runtime faster-whisper em Docker separado; e a publicação automática permanece desligada até credenciais OAuth, validação de quotas e testes por plataforma. Diarização, CLIP, thumbnails compostos automaticamente, legendas queimadas, coleta periódica de métricas e recalibração estatística são marcos futuros.

## Publicação automática — política

A publicação automática só deve ser ativada quando houver: revisão humana estabelecida (já implementada), logs de tentativa por publicação, retry idempotente, controle de cadência (gap mínimo de 60 minutos já implementado) e credenciais por plataforma devidamente configuradas. Até lá, as publicações ficam em `scheduled` e o adaptador `CredentialedPlatformPublisher` mantém o envio bloqueado, lançando erro claro em vez de falhar silenciosamente.
