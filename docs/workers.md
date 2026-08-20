# Cortes AI — Workers e Processamento

**Autor:** Manus AI · **Versão documentada:** 1.0

Os workers são consumidores independentes das filas Redis que executam o trabalho pesado do pipeline sem acoplar CPU pesada ao processo Node da aplicação web. Cada worker segue o mesmo contrato: consome tarefas JSON via `BLPOP`, valida o schema com Pydantic, executa a tarefa e notifica a aplicação pelo callback `POST /api/pipeline/callback` com o header `x-pipeline-token`.

## Filas

| Fila                  | Worker                    | Tarefa                                                                                                | Ambiente recomendado                                           |
| --------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `pipeline.cpu`        | `ingest_worker.py`        | Download, normalização FFmpeg (H.264/fast/CRF20, 30fps, faststart), extração de áudio PCM 16 kHz mono | CPU comum, FFmpeg                                              |
| `pipeline.cpu`        | `thumbnail_worker.py`     | Composição de thumbnail com texto (PIL, contorno preto + stroke ciano)                                | CPU comum                                                      |
| `pipeline.gpu`        | `transcription_worker.py` | faster-whisper `large-v3` com timestamps por palavra, VAD filter                                      | CUDA com `WHISPER_DEVICE=cuda`, `WHISPER_COMPUTE_TYPE=float16` |
| `pipeline.llm`        | —                         | Highlights, títulos, descrições, hashtags (chamadas diretas da API web ao LLM)                        | —                                                              |
| `pipeline.publishing` | (futuro)                  | Envio às plataformas com retry e observabilidade                                                      | —                                                              |
| `pipeline.analytics`  | (futuro)                  | Coleta periódica de métricas e recalibração                                                           | —                                                              |

## Contrato de idempotência

Cada tarefa carrega `idempotency_key`. Antes de processar, o worker consulta `cortes:idempotency:{key}` no Redis; se a chave existir, a tarefa é descartada silenciosamente. Após o callback concluído com sucesso, a chave é gravada com TTL de 24 h. Do lado da aplicação, o callback rejeita callbacks duplicados de jobs já `succeeded` (`{ updated: false, duplicate: true }`), o que dá idempotência em duas camadas.

## ingest_worker.py (CPU/FFmpeg)

```bash
docker build -t cortes-ingest workers/cpu
docker run -e REDIS_URL -e PIPELINE_CALLBACK_TOKEN -e QUEUE_NAME=pipeline.cpu cortes-ingest
```

Para cada tarefa o worker baixa o vídeo por URL assinada (streaming com chunks de 1 MB, timeout de 180 s), normaliza para MP4 H.264 (`-preset fast -crf 20 -r 30 -movflags +faststart`) e extrai o áudio PCM 16 kHz mono, retornando ambos em base64 no callback de sucesso. Em caso de falha, envia callback com `status: "failed"` e a mensagem de erro, gravando a chave de idempotência igualmente para não repetir o erro em loop.

## transcription_worker.py (GPU/faster-whisper)

```bash
docker build -t cortes-transcribe workers/python
docker run -e REDIS_URL -e PIPELINE_CALLBACK_TOKEN -e WHISPER_DEVICE=cuda cortes-transcribe
```

Transcreve com `word_timestamps=True` e `vad_filter=True`, normalizando o resultado para o contrato `segmentsJson` (`id`, `start`, `end`, `text`, `words[]` com `word/start/end/probability`) e retorna também `language`, `word_count`, `engine` e `model_version` — campos que alimentam a rastreabilidade `modelVersion` dos jobs. O README do worker (`workers/python/README.md`) documenta a operação em CPU/int8 para validação de contrato e o callback que deve validar `job_id`, `source_video_id`, `idempotency_key` e o schema antes de persistir.

## thumbnail_worker.py (CPU/PIL)

Módulo puro que recebe um frame selecionado (futuro worker de visão/CLIP), aplica o texto em caixa alta com contorno preto e stroke ciano `#00d7ff`, e salva com qualidade 95. A seleção do frame é intencionalmente desacoplada: o worker de visão pode ser conectado antes desta etapa sem alterar o contrato de saída.

## Callback da aplicação

`POST /api/pipeline/callback` (`server/pipelineCallback.ts`): valida o token, valida o payload com Zod, atualiza o job (`updatePipelineJobFromWorker` — que também avança o estado do vídeo conforme a tabela de transições) e, no sucesso de ingest, persiste `normalized.mp4` e `audio.wav` no storage e registra os artefatos `normalized_video` e `audio`. Falha de parsing retorna 400; token inválido ou ausente retorna 401.

## Scripts operacionais

| Script                           | Uso                                                      | O que faz                                                              |
| -------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| `scripts/inspect_cpu_queue.py`   | `python scripts/inspect_cpu_queue.py`                    | Mostra o tamanho da fila `pipeline.cpu` e o resumo das tarefas no topo |
| `scripts/requeue_cpu_ingest.mjs` | `tsx scripts/requeue_cpu_ingest.mjs <ownerId> <videoId>` | Reinseri o job de ingestão de um vídeo na fila (útil em diagnóstico)   |
