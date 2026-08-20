# Cortes AI — Projeto TODO

## Fundação e arquitetura

- [x] Definir contratos compartilhados de pipeline, estados, tipos de tarefa e idempotência.
- [ ] Documentar separação futura entre API web, workers CPU, workers GPU e workers LLM.
- [x] Definir estratégia de armazenamento S3/R2 com referências de artefatos e URLs temporárias.
- [ ] Registrar arquitetura de evolução para workers Python via Dockerfile customizado.

## Dados e rastreabilidade

- [x] Criar tabelas de vídeos-fonte, artefatos, jobs, transcrições, segmentos, candidatos, cortes, publicações, métricas e alertas.
- [x] Adicionar status, retry_count, error_message, model_version, prompt_version, processing_version e idempotency_key.
- [x] Adicionar índices e restrições para consultas por usuário, status, etapa, agendamento e plataforma.
- [x] Criar helpers de banco para listar, detalhar e atualizar entidades do pipeline.
- [x] Aplicar migração do banco e validar o schema real.

## Dashboard operacional

- [x] Criar layout autenticado com navegação para Visão geral, Vídeos, Revisão, Publicações e Analytics.
- [x] Implementar visão geral com contadores de vídeos, jobs, candidatos pendentes e publicações.
- [x] Implementar lista de vídeos com progresso por estado e erros recentes.
- [x] Implementar fila de revisão humana com score, categoria, título, duração e ações.
- [x] Implementar aprovação, rejeição com motivo e edição de metadados.
- [ ] Implementar tela de detalhe do pipeline com histórico de tarefas e artefatos.
- [x] Implementar placeholders controlados para preview assinado e renderização real.

## Pipeline e IA

- [ ] Implementar ingestão lógica com normalização, extração de áudio e criação de job.
- [ ] Implementar contrato de transcrição com timestamps por palavra e diarização futura.
- [ ] Implementar divisão da transcrição em janelas com overlap.
- [x] Implementar contrato de highlights com JSON validado por schema.
- [x] Implementar cálculo de score combinado e pós-processamento de sobreposição.
- [ ] Implementar contrato de renderização vertical e legendas ASS karaokê.
- [ ] Implementar geração de thumbnail e metadados como etapas desacopladas.
- [ ] Implementar notificações ao owner para revisão, falhas de publicação e score anômalo.

## Publicação e analytics

- [x] Criar modelo de publicação por plataforma com agendamento e cadência.
- [ ] Preparar integração segura com YouTube Shorts, TikTok e Instagram Reels.
- [x] Implementar estados de publicação, retry e idempotência.
- [x] Criar modelo de métricas pós-publicação.
- [x] Implementar dashboard de performance por plataforma, categoria, horário e corte.
- [ ] Implementar recalibração futura dos pesos do score com dados de desempenho.

## Qualidade e operação

- [x] Criar testes Vitest para contratos, estados, score e mutations principais.
- [x] Executar typecheck, testes e build.
- [x] Validar a interface em desktop e mobile.
- [x] Registrar limitações da primeira versão e próximos marcos de infraestrutura.
- [x] Salvar checkpoint somente após todos os itens entregues nesta fase estarem marcados como concluídos.

## Ajustes identificados na validação da primeira entrega

- [x] Criar entidade ou documentar formalmente a decisão de manter segmentos dentro de `transcripts.segmentsJson`.
- [x] Adicionar índice específico por plataforma em publicações.
- [x] Implementar helper de detalhe do pipeline com jobs e artefatos.
- [ ] Exibir progresso por etapa e erros recentes na tela de vídeos.
- [x] Implementar preview com URL assinada real quando houver artefato de mídia.
- [ ] Adicionar pós-processamento para remover ou mesclar candidatos sobrepostos.
- [ ] Implementar testes Vitest para `videos.register` e `review.update`.
- [x] Executar `pnpm build` e validar telas com viewport mobile.
- [x] Criar documento da versão 1 com limitações atuais e roadmap de workers/Docker/publicação.

- [x] Implementar tela de detalhe/preview consumindo `videos.detail` e renderizando mídia com URL assinada quando houver artefatos.
- [x] Salvar checkpoint real da primeira entrega após a validação final.
