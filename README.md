# Cortes AI

O **Cortes AI** é uma plataforma que transforma vídeos longos em cortes curtos prontos para publicação em **YouTube Shorts**, **TikTok** e **Instagram Reels**. O produto organiza ingestão, transcrição, detecção de highlights por IA, renderização vertical com legendas karaokê, revisão humana e publicação em um pipeline rastreável, onde cada etapa é registrada como um job idempotente e cada artefato gerado é referenciado por chave de objeto com URL temporária assinada.

| Aspecto     | Descrição                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| Visão geral | Painel autenticado com vídeos, fila de revisão, publicações e analytics                                                    |
| Frontend    | React 19 + Vite + TypeScript + Tailwind CSS 4 + shadcn/ui + tRPC                                                           |
| Backend     | Express + tRPC 11 + Drizzle (MySQL) + Zod 4                                                                                |
| Fila        | Redis com cinco filas lógicas: `pipeline.cpu`, `pipeline.gpu`, `pipeline.llm`, `pipeline.publishing`, `pipeline.analytics` |
| Workers     | Python: `ingest_worker` (FFmpeg), `transcription_worker` (faster-whisper), `thumbnail_worker` (PIL)                        |
| Testes      | Vitest com 27 testes, typecheck e build em CI manual (`pnpm check`, `pnpm test`, `pnpm build`)                             |

## Começando

Este projeto usa **pnpm**. Instale as dependências e copie o arquivo de exemplo de variáveis:

```bash
pnpm install
cp .env.example .env   # edite .env com seus valores
```

Durante o desenvolvimento:

```bash
pnpm dev          # servidor web com hot reload
pnpm check        # typecheck TypeScript
pnpm test         # suíte Vitest
pnpm build        # build de produção (client + servidor em dist/)
pnpm start        # serve o build de produção
```

As variáveis necessárias estão documentadas em `.env.example`. Para rodar os workers, consulte a seção **Workers** abaixo.

## Estrutura do repositório

```text
cortes-ai/
├── client/            # Frontend React (páginas, componentes, hooks)
├── server/            # Backend: rotas tRPC, banco, fila, callback, storage
│   ├── _core/         # Núcleo do template: auth, tRPC, LLM, storage, OAuth
│   └── *.test.ts      # Testes Vitest (27 testes)
├── shared/            # Contratos compartilhados (pipeline, score, tipos)
├── drizzle/           # Schema e migrações MySQL (6 migrações)
├── scripts/           # Utilitários operacionais (requeue, inspeção de fila)
├── workers/
│   ├── cpu/           # Ingestão FFmpeg + compositor de thumbnail (Docker)
│   └── python/        # Transcrição faster-whisper (Docker, CPU ou GPU)
└── docs/              # Documentação completa do sistema
```

Os contratos centrais vivem em `shared/pipeline.ts` (estados, transições, score, janelas de transcrição, deduplicação de candidatos, legendas ASS) e os helpers de banco em `server/db.ts` (contadores, listas, criação de jobs idempotentes, callbacks de workers).

## Como o pipeline funciona

1. **Registro e upload** — o usuário registra um vídeo e envia o binário (limite de 6 MB na V1); nomes de arquivo são sanitizados para ASCII antes do armazenamento e uma chave de idempotência evita registros duplicados.
2. **Enfileiramento** — o registro cria um job `ingest` na fila `pipeline.cpu`; ao clicar em **Gerar cortes**, o sistema enfileira `ingest` (CPU), `transcribe` (GPU), `detect_highlights` (LLM) e `render` (CPU) com chaves de idempotência por etapa.
3. **Workers** — cada worker consome sua fila no Redis, executa a tarefa e chama o callback `POST /api/pipeline/callback` autenticado por `x-pipeline-token`. O callback é idempotente e registra artefatos (vídeo normalizado, áudio, clip, vertical, legenda, thumbnail).
4. **Revisão humana** — candidatos de highlight com score vão para a fila de revisão; a aprovação gera o clip e os jobs de metadata e thumbnail; a rejeição exige motivo.
5. **Publicação** — publicações possuem estados, agendamento e cadência mínima; os conectores OAuth reais serão ativados em etapa futura (hoje a publicação permanece agendada).
6. **Analytics** — métricas por publicação alimentam o dashboard de performance e a recalibração dos pesos do score.

## Documentação

| Documento                 | Conteúdo                                                 |
| ------------------------- | -------------------------------------------------------- |
| `docs/sistema.md`         | Visão geral, comportamento, arquitetura e fluxo completo |
| `docs/menus-e-telas.md`   | O que cada menu e tela faz, ação por ação                |
| `docs/api.md`             | Contrato da API tRPC (inputs, respostas, erros)          |
| `docs/workers.md`         | Workers Python, Docker, Redis e callback                 |
| `docs/operacoes.md`       | Diagnóstico, scripts, variáveis de ambiente e limitações |
| `docs/desenvolvimento.md` | Convenções de código, testes e evolução do projeto       |

## Limitações conscientes da primeira versão

O upload binário, a normalização real com FFmpeg e a extração de áudio dependem dos workers externos; a transcrição depende do runtime Python/Docker com faster-whisper; e a publicação automática permanece desligada até a configuração de credenciais OAuth por plataforma. O roadmap completo está em `todo.md`.

## Licença

Código proprietário de [uelitonbueno](https://github.com/uelitonbueno).
