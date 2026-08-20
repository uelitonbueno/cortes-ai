# Cortes AI — Menus e Telas

**Autor:** Manus AI · **Versão documentada:** 1.0

Esta página descreve o comportamento de cada menu da navegação lateral e o que cada tela faz, ação por ação, de modo que um novo operador ou desenvolvedor saiba exatamente o que esperar ao navegar pelo produto.

## Navegação lateral

O layout autenticado (`client/src/components/DashboardLayout.tsx`) apresenta uma barra lateral com seis itens, redimensionável por arraste (entre 200 e 480 px, largura persistida em `localStorage`), colapsável a ícones com tooltip, e um rodapé com o avatar do usuário logado e o menu **Sair** (logout). Em dispositivos móveis, a barra vira uma barra superior com botão de toggle e o título do menu ativo. Todos os itens são protegidos por autenticação: um visitante sem sessão vê a tela de entrada com o botão **Entrar** e a mensagem "Entre para acompanhar seus vídeos, cortes, publicações e métricas em um único lugar".

| #   | Menu          | Rota            | Ícone           | O que faz                                         |
| --- | ------------- | --------------- | --------------- | ------------------------------------------------- |
| 1   | Visão geral   | `/`             | LayoutDashboard | Painel de comando do operador                     |
| 2   | Vídeos        | `/videos`       | Film            | Registro, upload e acompanhamento de vídeos-fonte |
| 3   | Revisão       | `/review`       | ListVideo       | Fila humana de aprovação de candidatos            |
| 4   | Publicações   | `/publications` | CalendarClock   | Publicações agendadas e publicadas por plataforma |
| 5   | Analytics     | `/analytics`    | BarChart3       | Métricas e recalibração do score                  |
| 6   | Configurações | `/settings`     | Settings2       | Integrações com plataformas de publicação         |

## 1. Visão geral (`/`)

É a tela de comando do operador, composta por um hero institucional ("Transforme vídeos longos em cortes que merecem publicação") com dois atalhos — **Adicionar vídeo** (vai para `/videos`) e **Abrir revisão** (vai para `/review`) — seguidos de dois blocos de informação.

O primeiro bloco traz **quatro cartões contadores** que refletem o estado do sistema em tempo real: **Vídeos** (vídeos-fonte registrados), **Em revisão** (candidatos com status `candidate`), **Agendados** (publicações `scheduled`) e **Publicados** (publicações `published`). O segundo bloco exibe a **atividade do pipeline**, com os seis jobs mais recentes (tipo de tarefa, fila, tentativa e selo de status), e a **saúde operacional**, que aponta o armazenamento seguro e o número de jobs falhados com a nota de que o retry automático será conectado aos workers na próxima etapa.

> Comportamento: os contadores vêm de `videos.overview` e os jobs de `jobs.recent`; quando não há atividade, a tela convida o operador a adicionar o primeiro vídeo.

## 2. Vídeos (`/videos`)

É a central de ingestão. O operador registra um vídeo com título, tipo de origem (`upload`, `youtube`, `twitch` ou `live`), URL original opcional e chave de idempotência — clicar duas vezes no botão com a mesma chave nunca duplica o registro. No modo upload, o formulário lê o binário, converte para base64 (limite de 6 MB na V1) e envia `videos.upload`; o nome do arquivo é **sanitizado para ASCII** antes de tocar o armazenamento, o que previne o erro histórico `file path must be ASCII`.

A lista exibe até 50 vídeos mais recentes com **progresso por estado** (badge do estado do pipeline) e os **erros recentes** quando o pipeline falha. Ao abrir o detalhe de um vídeo (`/videos/:id`), o operador chega à tela de auditoria do pipeline, descrita a seguir.

| Ação         | O que acontece                                                                                                 |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| Registrar    | Cria `source_video` com estado `uploaded` e o job `ingest` em fila                                             |
| Upload       | Armazena o binário sanitizado, registra o artefato `raw_video` e enfileira `ingest` com URL assinada           |
| Gerar cortes | Cria/atualiza os quatro jobs (ingest → transcribe → detect_highlights → render) e leva o vídeo a `normalizing` |
| Reprocessar  | Reexecuta `start` do zero (idempotente por chave de etapa)                                                     |
| Cancelar     | Marca todos os jobs como `cancelled` e o vídeo como `failed`                                                   |
| Atualizar    | Refetch manual; durante execução a tela atualiza sozinha a cada 5 segundos                                     |

### Detalhe do vídeo (`/videos/:id`)

A tela de auditoria tem três áreas. O cabeçalho mostra o título, o estado atual, a versão de processamento e os botões **Atualizar**, **Gerar cortes**, **Reprocessar** e **Cancelar**, com mensagem contextual ("O vídeo foi recebido. Clique em Gerar cortes...", "Reprocesse para reenfileirar as etapas", "acompanhado automaticamente"). O painel **Progresso da geração** renderiza as quatro etapas (Normalização → Transcrição → Detecção de highlights → Renderização) como cartões coloridos: cinza (pendente), ciano (executando), verde (concluída) e vermelho (falhou), com retry count por job. O painel **Artefatos e preview seguro** mostra cada artefato com player de vídeo, player de áudio ou imagem usando **URL temporária assinada** quando disponível, e o **Histórico de tarefas** lista os jobs com fila, status, tentativas e mensagens de erro.

## 3. Revisão (`/review`)

É a fila humana que impede publicação automática de conteúdo não verificado. A lista carrega os candidatos pendentes (`clip_candidates` com status `candidate`), ordenados do maior para o menor `finalScore`, exibindo score, categoria, título sugerido, duração e transcrição de apoio.

| Ação          | O que acontece                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Aprovar       | Candidato vai a `approved`, cria o clip com estado `rendering` e enfileira os jobs `metadata` (LLM) e `thumbnail` (CPU) vinculados ao clip |
| Rejeitar      | Exige motivo (opcional); candidato sai da fila                                                                                             |
| Editar título | O título sugerido pode ser ajustado antes da aprovação                                                                                     |

## 4. Publicações (`/publications`)

Lista as publicações do operador por plataforma (YouTube, TikTok e Instagram), com status `scheduled` ou `published`, datas de agendamento e o histórico de envio. O modelo impõe **cadência mínima de 60 minutos** entre agendamentos (`isPublicationAllowed`) e gera chave de idempotência por plataforma + clip + data. Os conectores de publicação ainda são adaptadores seguros (`CredentialedPlatformPublisher` lança erro quando as credenciais não estão configuradas, mantendo a publicação apenas agendada), conforme registrado nas limitações da V1.

## 5. Analytics (`/analytics`)

Consolida as métricas pós-publicação — visualizações, curtidas, comentários, compartilhamentos, retenção média e total de publicações — somadas sobre todas as publicações do operador (`analytics.summary`). Também expõe a **última calibração de score** (`analytics.latestCalibration`), que registra os pesos `llm/audio/chat`, o tamanho da amostra e a versão do modelo; a recalibração automática a partir de dados de desempenho é o próximo marco de evolução.

## 6. Configurações (`/settings`) → Integrações

A seção de **integrações de publicação** contém um formulário por plataforma (YouTube Shorts, TikTok, Instagram Reels) para definir o endpoint de publicação e o token de acesso, com estes comportamentos de segurança: a leitura devolve o token **mascarado** (ex.: `abcd••••mnop`), o token só pode ser substituído por inteiro (nunca exibido completo), a tabela é protegida por owner e a publicação fica **desativada por padrão** (`enabled: false`). Testes dedicados (`server/integrations.test.ts`) cobrem leitura mascarada, atualização e bloqueio quando credenciais não existem.

## Fluxo de ponta a ponta pela interface

O operador entra, registra e envia um vídeo em **Vídeos**, clica em **Gerar cortes** e acompanha as quatro etapas no detalhe enquanto os workers processam. Quando os candidatos aparecem (estado `awaiting_review`), a tela **Revisão** lista os melhores; ao aprovar um candidato, os jobs de metadata e thumbnail são gerados e a publicação vai para **Agendados** em **Publicações**. Por fim, **Analytics** consolida o desempenho que, no futuro, recalibrará o score automaticamente.
