# Cortes AI — Guia de Desenvolvimento

**Autor:** Manus AI · **Versão documentada:** 1.0

## Convenções do repositório

O código é TypeScript estrito em todo o caminho (client, server e shared), com formatação Prettier (`pnpm format`). Os contratos que client e server compartilham vivem em `shared/` e são a única fonte de verdade para estados, tipos de tarefa, score e chaves de idempotência — nunca duplique um contrato no client. As rotas tRPC usam `protectedProcedure` com validação Zod 4 na entrada, e os helpers de banco (`server/db.ts`) sempre filtram por `ownerId` do contexto para garantir o isolamento de dados entre usuários.

| Camada     | Regra                                                                          |
| ---------- | ------------------------------------------------------------------------------ |
| `shared/`  | Contratos puros, sem dependência de runtime (testáveis isoladamente)           |
| `server/`  | Rotas tRPC magras; lógica em helpers de banco; side effects por job + callback |
| `client/`  | Sem lógica de negócio; apenas composição de hooks tRPC e componentes shadcn    |
| `workers/` | Python com Pydantic; um worker por container; nenhum segredo embutido          |
| `drizzle/` | Migrações nomeadas; `segmentsJson` preservado como snapshot imutável           |
| `docs/`    | Documentação viva; atualizar junto com o código                                |

## Testes

Os testes rodam com Vitest em ambiente Node, cobrindo `server/`. A organização vigente:

| Arquivo                                       | Cobertura                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `pipeline.contracts.test.ts` (13)             | Transições de estado, score combinado, janelas de transcrição, sobreposição, ASS, cadência |
| `storage.filename.test.ts` (3)                | Sanitização ASCII, path traversal, fallback seguro                                         |
| `routers.feature.test.ts` (4)                 | Registro, start/cancel/retry, integrações, aprovação de candidato                          |
| `pipelineCallback.test.ts` (2)                | Token inválido (401), payload inválido (400)                                               |
| `queue.redis.test.ts` (3)                     | Conexão, deduplicação de idempotência, fallback sem Redis                                  |
| `auth.logout.test.ts`, `integrations.test.ts` | Logout e leitura mascarada/bloqueio                                                        |

Ao adicionar funcionalidade nova, escreva testes de contrato em `shared/` (baratos e determinísticos) e testes de feature com `vi.mock("./db")` e `vi.mock("./storage")` para isolar a rota. O setup global em `server/__tests__/vitest.setup.ts` deve conter apenas defaults de ambiente que não exponham segredos reais.

## Evolução do produto (roadmap)

O `todo.md` mantém o estado real do backlog. Os marcos abertos são: substituir os adaptadores de publicação por conectores OAuth reais das três plataformas; criar o job periódico de analytics com recalibração dos pesos do detector; concluir o diagnóstico do processamento parado; e implementar o consumidor Redis da fila `pipeline.cpu` em segundo plano. A ordem planejada de evolução é: upload seguro e ingestão real → primeiro worker Python → render vertical com legendas ASS e thumbnail → revisão com artefatos reais → integração de publicação → coleta de analytics.

## Decisões registradas

A decisão de manter `segmentsJson` em vez de tabelas normalizadas está registrada em `docs-v1.md` junto com a estratégia de migração futura (tabelas normalizadas mantendo o snapshot imutável). A decisão de segregar CPU/GPU/LLM em filas distintas está registrada na arquitetura de evolução: a API web nunca executa trabalho pesado, e workers GPU rodam em ambiente persistente com Docker e GPU, conectados ao banco, ao storage e ao Redis.

## Estilo dos contratos de IA

As chamadas ao LLM usam `response_format` do tipo `json_schema` com `strict: true` (`additionalProperties: false`), garantindo JSON validável por schema antes de qualquer uso — `generateClipMetadata` e `detectHighlightsPreview` seguem esse padrão. Resultados que falharem no parse retornam estruturas vazias seguras em vez de propagar erro para o client.
