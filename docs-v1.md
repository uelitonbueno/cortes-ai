# Cortes AI — V1 e roadmap técnico

## O que está implementado

A primeira versão entrega a fundação autenticada do produto, o schema persistente do pipeline, os estados de processamento, as filas lógicas, os contratos de score e idempotência, a visão geral do dashboard, o registro de vídeos fonte, a fila de revisão humana, o modelo de publicações e métricas, além da prévia de highlights com resposta JSON validada por schema.

A V1 mantém deliberadamente os segmentos e as palavras com timestamps dentro de `transcripts.segmentsJson`. Essa decisão reduz a complexidade de migração enquanto o contrato de transcrição ainda está evoluindo, preserva a estrutura completa retornada pelo ASR e permite guardar diarização futura sem perder campos. Quando consultas por palavra, busca textual ou edição granular exigirem escala, a evolução prevista é criar tabelas normalizadas de segmentos e palavras, mantendo `segmentsJson` como snapshot imutável do resultado original.

O armazenamento foi modelado com referências a objetos e o backend já possui o helper para gerar URLs temporárias assinadas quando houver artefatos registrados. O banco registra versões de processamento, tentativas, erros, chaves idempotentes, versões de modelo e versões de prompt.

## Limitações conscientes da primeira versão

O registro atual de vídeo ainda é um contrato de ingestão; o upload binário, a normalização real com FFmpeg, a extração de áudio e o render definitivo serão conectados aos workers na próxima etapa. A transcrição está contratada para timestamps por palavra, mas o worker faster-whisper ainda depende de um runtime Python/Docker separado da aplicação web.

A publicação automática ainda não envia conteúdo às plataformas. O produto já possui estados, agendamento, filas e identificadores por plataforma, mas YouTube, TikTok e Instagram exigirão credenciais OAuth, validação de quotas e testes específicos de cada API antes de ativar envio automático.

A diarização avançada, CLIP, composição de thumbnail, legendas ASS queimadas no vídeo, coleta periódica de métricas e recalibração estatística estão planejadas como workers especializados. Não foram simulados dados de clientes, reviews, ratings ou métricas artificiais.

## Arquitetura de evolução

A API web continuará responsável por autenticação, controle, revisão, contratos tRPC e metadados. Workers CPU tratarão ingestão, FFmpeg e renderização. Workers GPU tratarão faster-whisper, diarização e CLIP. Workers LLM tratarão highlights, títulos, descrições, hashtags e thumbnails textuais. Workers de publicação e analytics serão separados para permitir retry e observabilidade específicos.

A execução Python com Docker e GPU não deve ser embutida no processo Node da aplicação web. Ela deve rodar em ambiente persistente ou serviço especializado, conectado ao banco, ao armazenamento de objetos e às filas Redis/Celery. A aplicação web registra jobs e acompanha seus estados; o worker executa a tarefa de forma idempotente.

## Próximos marcos

O próximo marco é conectar upload seguro e ingestão real, gerar jobs de transcrição e criar o primeiro worker Python. Em seguida, serão adicionados render vertical, legendas ASS, thumbnail e metadados. Depois disso, será implementada a revisão com preview de artefatos reais, seguida pelas integrações de publicação e coleta de analytics.

A publicação automática deve permanecer desligada até que haja revisão humana, logs de tentativa, retry idempotente, controle de cadência e credenciais por plataforma devidamente configurados.
