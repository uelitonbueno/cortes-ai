# Cortes AI — Documentação do Sistema

**Autor:** Manus AI · **Versão documentada:** 1.0 · **Data:** agosto de 2026

## 1. O que é o Cortes AI

O Cortes AI é uma plataforma SaaS que transforma vídeos longos — podcasts, lives, aulas e entrevistas — em cortes curtos otimizados para YouTube Shorts, TikTok e Instagram Reels. A diferença central em relação a editores manuais é que todo o ciclo de vida do corte é **rastreável**: cada vídeo-fonte tem seu estado de pipeline, cada tarefa de processamento é um job com tentativas e erros registrados, e cada arquivo gerado (vídeo normalizado, áudio, clip vertical, legenda, thumbnail) é um artefato com chave de armazenamento e URL temporária assinada.

O sistema está desenhado em torno de três princípios de engenharia que orientam todas as decisões: **idempotência** (nenhuma operação duplica trabalho quando repetida), **segregação por perfil de máquina** (filas separadas para CPU, GPU e LLM) e **revisão humana no meio do fluxo** (nenhum corte é publicado sem aprovação do operador, e a publicação automática permanece desligada por padrão).

## 2. Arquitetura de alto nível

A arquitetura separa a aplicação web dos workers de processamento, conectados apenas por Redis e pelo banco de dados.

```text
                    ┌──────────────────────────────┐
 Browser ── HTTPS ─►│  App web (Express + tRPC)    │
                    │  auth · dashboard · rotas    │
                    │  callback /api/pipeline      │
                    └──────────┬───────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        ┌───────────┐  ┌────────────┐  ┌──────────────────┐
        │  MySQL    │  │   Redis    │  │  Storage S3/R2   │
        │ (Drizzle) │  │   (filas)  │  │  (Forge/S3)      │
        └───────────┘  └─────┬──────┘  └──────────────────┘
                             ▼
        ┌────────────────────────────────────────────┐
        │ Workers                                     │
        │  pipeline.cpu    → ingest (FFmpeg) + render │
        │  pipeline.gpu    → transcrição (whisper)    │
        │  pipeline.llm    → highlights + metadata    │
        │  pipeline.pub    → publicação (futuro)      │
        │  pipeline.analy  → métricas (futuro)        │
        └────────────────────────────────────────────┘
```

A aplicação web é responsável por autenticação, apresentação, contratos tRPC e controle do pipeline. Os workers consomem filas Redis e notificam a aplicação por um **callback autenticado** (`POST /api/pipeline/callback`, header `x-pipeline-token`), que atualiza jobs e artefatos de forma idempotente. A execução Python (faster-whisper, CLIP) nunca roda dentro do processo Node da aplicação web; ela vive em containers Docker separados, preparados inclusive para GPU (`WHISPER_DEVICE=cuda`, `WHISPER_COMPUTE_TYPE=float16`).

| Camada   | Tecnologia                             | Papel                                                            |
| -------- | -------------------------------------- | ---------------------------------------------------------------- |
| Frontend | React 19, Vite, Tailwind 4, shadcn/ui  | Interface autenticada em seis telas                              |
| API      | Express + tRPC 11 + Zod 4              | Validação de entrada tipada ponta a ponta                        |
| Dados    | MySQL + Drizzle (6 migrações)          | Schema persistente com índices por owner/status/plataforma       |
| Fila     | Redis (ioredis)                        | Cinco filas lógicas com idempotência de 24 h                     |
| Storage  | Forge/S3 presign                       | Upload direto e URLs assinadas temporárias                       |
| IA       | OpenAI-compatible LLM + faster-whisper | Highlights com JSON validado por schema; transcrição por palavra |
| Workers  | Python 3.11 + FFmpeg + Pillow          | Ingestão, transcrição e thumbnail em containers                  |

## 3. Modelo de dados

O schema (`drizzle/schema.ts`, 6 migrações aplicadas) cobre a jornada completa: `source_videos` (vídeos-fonte com estado de pipeline), `media_artifacts` (arquivos com chave de storage), `processing_jobs` (tarefas com `retry_count`, `max_retries`, `error_message`, `model_version`, `prompt_version`, `idempotency_key`), `transcripts` (com `segmentsJson` preservando a estrutura completa do ASR), `clip_candidates` (candidatos com score), `clips` (cortes aprovados), `publications` (com índice por plataforma), `metrics` (métricas pós-publicação), `score_calibrations` (pesos recalibrados), `pipeline_alerts` e `integration_settings` (credenciais por owner e plataforma, protegidas por usuário).

Uma decisão documentada em `docs-v1.md` mantém segmentos e palavras com timestamp dentro de `transcripts.segmentsJson` nesta versão: isso reduz a complexidade de migração enquanto o contrato de transcrição evolui e preserva diarização futura. Quando consultas por palavra ou busca textual exigirem escala, a evolução prevista é normalizar segmentos e palavras em tabelas próprias, mantendo `segmentsJson` como snapshot imutável.

## 4. Estados do pipeline e transições

O estado do vídeo segue uma máquina de estados estrita validada em `shared/pipeline.ts`:

> `uploaded → normalizing → transcribing → detecting → rendering → awaiting_review → approved → scheduled → published`

| Estado            | Significado                                    | Quem o produz                 |
| ----------------- | ---------------------------------------------- | ----------------------------- |
| `uploaded`        | Vídeo registrado e armazenado                  | Frontend (registro/upload)    |
| `normalizing`     | Worker FFmpeg processando                      | Callback `ingest` em execução |
| `transcribing`    | Áudio normalizado pronto; transcrição pendente | Callback `ingest` concluído   |
| `detecting`       | Transcrição pronta; detecção de highlights     | Callback `transcribe`         |
| `rendering`       | Candidatos selecionados; render em andamento   | Callback `detect_highlights`  |
| `awaiting_review` | Cortes candidatos aguardando o operador        | Callback `render`             |
| `approved`        | Candidato aceito pelo operador                 | `review.update`               |
| `scheduled`       | Publicação agendada                            | Modelo de publicações         |
| `published`       | Publicado na plataforma                        | Worker de publicação (futuro) |

Transições inválidas são rejeitadas por `isValidTransition`. Falhas e cancelamentos saem da cadeia para `failed`, e o retry reexecuta `startSourceVideoPipeline`, que reenfileira os quatro estágios com idempotência.

## 5. Detecção de highlights e score

A detecção combina três sinais em `combinedHighlightScore`: o score do LLM (peso 0,6), o sinal de áudio (0,2) e o sinal de chat (0,2), normalizado para 0–100. A transcrição longa é dividida em janelas de 900 segundos com 120 segundos de overlap (`splitTranscriptWindows`), e o prompt de detecção exige JSON validado por schema com `start`, `end`, `category`, `viral_score`, `hook_text`, `reasoning` e `suggested_title`. Depois da geração, `removeOverlappingCandidates` elimina candidatos com interseção sobre união acima de 30%, priorizando o maior score — o pós-processamento que evita cortes redundantes sobre o mesmo trecho.

As legendas de saída usam o formato **ASS com karaokê** (`\k` em centissegundos por palavra), geradas por `buildAssKaraoke`, e o render vertical aplica `crop=ih*9/16:ih` com scale para 1080×1920, pronto para receber `face_tracking` e `speaker_tracking` no futuro.

## 6. Segurança e idempotência

O sistema aplica idempotência em quatro pontos: registro de vídeo (chave no banco), jobs (`cortes:queue:idempotency:{key}` no Redis com TTL de 24 h e índice único em `processing_jobs`), callback de workers (rejeita callback já concluído com `duplicate: true`) e upload (nome sanitizado para ASCII, extensão preservada, sufixo determinístico contra colisão). A segurança cobre autenticação via OAuth do template, proteção de todas as rotas por `protectedProcedure`, validação de token nos callbacks de workers, mascaramento de credenciais na leitura de integrações (`maskIntegrationSecret` mostra apenas as 4 primeiras e 4 últimas posições) e publicação desligada por padrão.

## 7. Qualidade e validação

A suíte Vitest roda em segundos e cobre contratos de pipeline (13 testes de transições, score, janelas e sobreposição), sanitização de nomes de arquivo, autenticação do callback, features do router (registro, start/cancel/retry, integrações, revisão), logout, leitura de integrações e comportamento da fila Redis (deduplicação e fallback sem `REDIS_URL`). A validação completa da entrega usa três comandos:

```bash
pnpm check   # typecheck sem erros
pnpm test    # 27 testes passando
pnpm build   # client + servidor em dist/
```

## 8. Limitações conscientes e roadmap

A primeira versão trata o registro de vídeo como contrato de ingestão (upload limitado a 6 MB, workers externos necessários para normalização real); a transcrição por palavra depende do runtime faster-whisper em Docker; a publicação automática não envia conteúdo às plataformas até a configuração de credenciais OAuth com teste de quotas; e recursos como diarização, CLIP, métricas coletadas periodicamente e recalibração estatística do score são planos da próxima fase. O detalhamento está em `docs/operacoes.md` e `todo.md`.
