"""Worker CPU de ingestão: normaliza vídeo e extrai áudio para ASR."""

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
        return {"normalized_path": str(normalized), "audio_path": str(audio), "normalized_bytes": normalized.stat().st_size, "audio_bytes": audio.stat().st_size}


def main() -> None:
    redis = Redis.from_url(os.environ["REDIS_URL"], decode_responses=True)
    queue = os.getenv("QUEUE_NAME", "pipeline.cpu")
    while True:
        _, raw = redis.blpop(queue)
        task = IngestTask.model_validate_json(raw)
        key = f"cortes:idempotency:{task.idempotency_key}"
        if redis.exists(key):
            continue
        result = process(task)
        response = requests.post(str(task.callback_url), json={"job_id": task.job_id, "source_video_id": task.source_video_id, "result": result, "idempotency_key": task.idempotency_key}, timeout=120)
        response.raise_for_status()
        redis.set(key, "succeeded")


if __name__ == "__main__":
    main()
