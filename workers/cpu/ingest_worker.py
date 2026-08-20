"""Consumidor CPU de ingestão: baixa o vídeo, normaliza com FFmpeg, extrai áudio e notifica a API."""

import base64
import os
import subprocess
import tempfile
from pathlib import Path

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


def run_ffmpeg(args: list[str]) -> None:
    subprocess.run(["ffmpeg", "-y", *args], check=True, capture_output=True, text=True)


def process(task: IngestTask) -> dict:
    with tempfile.TemporaryDirectory(prefix="cortes-ingest-") as directory:
        root = Path(directory)
        raw = root / "raw.mp4"
        normalized = root / "normalized.mp4"
        audio = root / "audio.wav"
        with requests.get(str(task.source_url), stream=True, timeout=180) as response:
            response.raise_for_status()
            with raw.open("wb") as output:
                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        output.write(chunk)
        run_ffmpeg(["-i", str(raw), "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-c:a", "aac", "-b:a", "192k", "-r", "30", "-movflags", "+faststart", str(normalized)])
        run_ffmpeg(["-i", str(normalized), "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", str(audio)])
        return {"normalizedBase64": base64.b64encode(normalized.read_bytes()).decode("ascii"), "audioBase64": base64.b64encode(audio.read_bytes()).decode("ascii"), "normalizedBytes": normalized.stat().st_size, "audioBytes": audio.stat().st_size}


def main() -> None:
    redis = Redis.from_url(os.environ["REDIS_URL"], decode_responses=True)
    queue = os.getenv("QUEUE_NAME", "pipeline.cpu")
    callback_token = os.environ["PIPELINE_CALLBACK_TOKEN"]
    while True:
        _, raw = redis.blpop(queue)
        task = IngestTask.model_validate_json(raw)
        key = f"cortes:idempotency:{task.idempotency_key}"
        if redis.exists(key):
            continue
        try:
            result = process(task)
            response = requests.post(str(task.callback_url), json={"jobId": task.job_id, "sourceVideoId": task.source_video_id, "ownerId": task.owner_id, "jobType": "ingest", "status": "succeeded", "idempotencyKey": task.idempotency_key, **result}, headers={"x-pipeline-token": callback_token}, timeout=180)
            response.raise_for_status()
            redis.set(key, "succeeded", ex=86400)
        except Exception as error:
            requests.post(str(task.callback_url), json={"jobId": task.job_id, "sourceVideoId": task.source_video_id, "ownerId": task.owner_id, "jobType": "ingest", "status": "failed", "idempotencyKey": task.idempotency_key, "errorMessage": str(error)}, headers={"x-pipeline-token": callback_token}, timeout=30)
            redis.set(key, "failed", ex=86400)


if __name__ == "__main__":
    main()
