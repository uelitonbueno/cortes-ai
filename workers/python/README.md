# Worker Python de transcrição

Este worker é separado do servidor web e consome tarefas JSON da fila Redis `pipeline.gpu`. Ele baixa o áudio por URL temporária, executa faster-whisper com timestamps por palavra e envia o resultado para um callback interno. A chave de idempotência impede reprocessamento silencioso da mesma tarefa.

Em produção, o worker deve ser executado em ambiente persistente com Redis, acesso ao banco e armazenamento de objetos. Para GPU, use uma imagem CUDA compatível e configure `WHISPER_DEVICE=cuda` e `WHISPER_COMPUTE_TYPE=float16`. A imagem padrão usa CPU/int8 para desenvolvimento e validação de contrato.

O callback deve validar `job_id`, `source_video_id`, `idempotency_key` e o schema `segmentsJson` antes de persistir. O worker não deve publicar diretamente em plataformas sociais; essa responsabilidade pertence a uma fila separada de publicação.
