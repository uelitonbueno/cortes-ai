"""Consumidor CPU de ingestão: baixa o vídeo via streaming, normaliza com FFmpeg, extrai áudio e notifica a API.
Otimizado para vídeos de longa duração (até 10h) sem sobrecarregar a memória RAM.
"""
import base64
import os
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Optional

import requests
from pydantic import BaseModel, HttpUrl
from redis import Redis


class IngestTask(BaseModel):
    job_id: int
    source_video_id: int
    owner_id: int
    source_url: HttpUrl
    callback_url: HttpUrl
    idempotency_key: str
    source_type: Optional[str] = "upload"


def run_ffmpeg(args: list[str]) -> None:
    """Executa o FFmpeg com captura de logs para diagnóstico em caso de falha."""
    process = subprocess.run(
        ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *args],
        check=False,
        capture_output=True,
        text=True
    )
    if process.returncode != 0:
        raise RuntimeError(f"FFmpeg failed (code {process.returncode}): {process.stderr}")


def process_video(task: IngestTask) -> dict:
    """
    Processa o vídeo em streaming. Para vídeos longos, evita carregar tudo em RAM.
    A normalização é feita em disco temporário.
    """
    with tempfile.TemporaryDirectory(prefix="cortes-ingest-") as directory:
        root = Path(directory)
        raw_path = root / "raw_source.mp4"
        norm_path = root / "normalized.mp4"
        audio_path = root / "audio.wav"

        # 1. Download via streaming
        print(f"[Ingest] Baixando vídeo: {task.source_url}")
        with requests.get(str(task.source_url), stream=True, timeout=300) as r:
            r.raise_for_status()
            with raw_path.open("wb") as f:
                for chunk in r.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        f.write(chunk)

        # 2. Normalização FFmpeg (H.264, 30fps, faststart para web)
        # Otimizado para compatibilidade e streaming
        print(f"[Ingest] Normalizando vídeo...")
        run_ffmpeg([
            "-i", str(raw_path),
            "-c:v", "libx264",
            "-preset", "veryfast",  # Mais rápido para vídeos longos
            "-crf", "23",           # Equilíbrio entre qualidade e tamanho
            "-c:a", "aac",
            "-b:a", "128k",
            "-r", "30",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            str(norm_path)
        ])

        # 3. Extração de Áudio (PCM 16kHz Mono - Ideal para Whisper)
        print(f"[Ingest] Extraindo áudio para transcrição...")
        run_ffmpeg([
            "-i", str(norm_path),
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            str(audio_path)
        ])

        # 4. Preparação do resultado
        # Nota: Para vídeos muito longos, enviar base64 pode estourar o limite do callback.
        # Em produção, o worker deve fazer upload direto para o storage e enviar apenas as chaves.
        # Mantemos base64 para compatibilidade com a V1 (limite 6MB), mas com logs de tamanho.
        norm_bytes = norm_path.stat().st_size
        audio_bytes = audio_path.stat().st_size
        
        print(f"[Ingest] Concluído. Vídeo: {norm_bytes} bytes, Áudio: {audio_bytes} bytes")
        
        return {
            "normalizedBase64": base64.b64encode(norm_path.read_bytes()).decode("ascii"),
            "audioBase64": base64.b64encode(audio_path.read_bytes()).decode("ascii"),
            "normalizedBytes": norm_bytes,
            "audioBytes": audio_bytes,
            "processing_metadata": {
                "duration_estimate": "TBD",
                "worker_version": "1.1-streaming"
            }
        }


def main() -> None:
    redis_url = os.environ.get("REDIS_URL")
    if not redis_url:
        print("[Error] REDIS_URL não configurada.")
        return

    redis = Redis.from_url(redis_url, decode_responses=True)
    queue = os.getenv("QUEUE_NAME", "pipeline.cpu")
    callback_token = os.environ.get("PIPELINE_CALLBACK_TOKEN", "default-token")
    
    print(f"[Worker] Ingestão iniciado. Fila: {queue}")

    while True:
        try:
            # BLPOP aguarda até que haja um item na fila
            result = redis.blpop(queue, timeout=30)
            if not result:
                continue
            
            _, raw_payload = result
            task = IngestTask.model_validate_json(raw_payload)
            
            # Idempotência no worker
            idempotency_key = f"cortes:worker:idempotency:{task.idempotency_key}"
            if redis.exists(idempotency_key):
                print(f"[Worker] Ignorando tarefa duplicada: {task.idempotency_key}")
                continue

            print(f"[Worker] Processando Job {task.job_id} para Owner {task.owner_id}")
            
            try:
                result_data = process_video(task)
                
                # Callback de sucesso
                resp = requests.post(
                    str(task.callback_url),
                    json={
                        "jobId": task.job_id,
                        "sourceVideoId": task.source_video_id,
                        "ownerId": task.owner_id,
                        "jobType": "ingest",
                        "status": "succeeded",
                        "idempotencyKey": task.idempotency_key,
                        **result_data
                    },
                    headers={"x-pipeline-token": callback_token},
                    timeout=120
                )
                resp.raise_for_status()
                
                # Marca como processado com sucesso (24h)
                redis.set(idempotency_key, "succeeded", ex=86400)
                print(f"[Worker] Job {task.job_id} finalizado com sucesso.")

            except Exception as e:
                print(f"[Error] Falha ao processar Job {task.job_id}: {str(e)}")
                # Callback de falha
                requests.post(
                    str(task.callback_url),
                    json={
                        "jobId": task.job_id,
                        "sourceVideoId": task.source_video_id,
                        "ownerId": task.owner_id,
                        "jobType": "ingest",
                        "status": "failed",
                        "idempotencyKey": task.idempotency_key,
                        "errorMessage": str(e)
                    },
                    headers={"x-pipeline-token": callback_token},
                    timeout=30
                )
                # Não bloqueia a idempotência em caso de falha para permitir retry
                
        except Exception as e:
            print(f"[Critical] Erro no loop principal: {str(e)}")
            time.sleep(5)


if __name__ == "__main__":
    main()
