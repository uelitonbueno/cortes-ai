# Integração do Creator Studio AI V2

Esta branch preserva a arquitetura existente do `cortes-ai`: pipeline por etapas, filas Redis segregadas, callbacks autenticados, candidatos de clip, publicações, métricas e calibração de score. A integração não substitui `server/routers.ts`, `drizzle/schema.ts` ou os workers existentes.

## O que foi integrado

O cálculo de desempenho do Creator Studio AI V2 foi adaptado ao modelo remoto. O score editorial corresponde a `clip_candidates.finalScore`; os sinais de views, likes, comentários, compartilhamentos e retenção são lidos da cadeia `metrics -> publications -> clips -> clip_candidates`. A procedure `review.list` passa a retornar `performanceScore` e ordenar os candidatos por esse valor, mantendo `finalScore` como fallback quando não existem métricas coletadas.

A lógica é puramente determinística, limitada ao proprietário autenticado e não cria dados de analytics. O contrato mantém compatibilidade com os campos já persistidos pelo repositório remoto e não exige migração de schema.

## Limites preservados

Publicação oficial e coleta periódica continuam dependendo das credenciais OAuth e dos workers/adapters já previstos no projeto remoto. A branch não habilita tokens fictícios, não altera a `main` e não substitui o worker CPU, o worker Python ou a fila Redis.

## Validação

O typecheck e o build de produção passam nesta branch. A suíte completa mantém duas falhas ambientais já existentes quando `PIPELINE_CALLBACK_TOKEN` e `REDIS_URL` não estão configurados; o novo teste unitário de score passa isoladamente junto com os demais testes funcionais.
