"""Worker de transcrição do Cortes AI.

O processo consome tarefas JSON da fila Redis `pipeline.gpu`. A integração de
produção deve fornecer URLs temporárias para o áudio e um endpoint interno
para persistir o resultado; nenhum segredo é embutido neste arquivo.
"""

import json
import os
import tempfile
from pathlib import Path

import requests
from faster_whisper import WhisperModel
from pydantic import BaseModel, HttpUrl
from redis import Redis


class TranscriptionTask(BaseModel):
    job_id: int
    source_video_id: int
    audio_url: HttpUrl
    callback_url: HttpUrl
    language: str | None = None
    model_name: str = "large-v3"
    idempotency_key: str


def download_audio(url: str, destination: Path) -> None:
    with requests.get(url, stream=True, timeout=120) as response:
        response.raise_for_status()
        with destination.open("wb") as output:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    output.write(chunk)


def transcribe(task: TranscriptionTask, model: WhisperModel) -> dict:
    with tempfile.TemporaryDirectory(prefix="cortes-ai-") as directory:
        audio_path = Path(directory) / "audio.wav"
        download_audio(str(task.audio_url), audio_path)
        segments, info = model.transcribe(str(audio_path), language=task.language, word_timestamps=True, vad_filter=True, initial_prompt="Vídeo do Cortes AI")
        normalized = []
        word_count = 0
        for index, segment in enumerate(segments):
            words = []
            for word in segment.words or []:
                words.append({"word": word.word, "start": word.start, "end": word.end, "probability": word.probability})
                word_count += 1
            normalized.append({"id": index, "start": segment.start, "end": segment.end, "text": segment.text.strip(), "words": words})
        return {"language": info.language, "segments": normalized, "word_count": word_count, "engine": "faster-whisper", "model_version": task.model_name}


def main() -> None:
    redis_url = os.environ["REDIS_URL"]
    queue_name = os.getenv("QUEUE_NAME", "pipeline.gpu")
    redis = Redis.from_url(redis_url, decode_responses=True)
    model = WhisperModel(os.getenv("WHISPER_MODEL", "large-v3"), device=os.getenv("WHISPER_DEVICE", "cpu"), compute_type=os.getenv("WHISPER_COMPUTE_TYPE", "int8"))
    while True:
        _, raw = redis.blpop(queue_name)
        task = TranscriptionTask.model_validate_json(raw)
        result_key = f"cortes:idempotency:{task.idempotency_key}"
        if redis.exists(result_key):
            continue
        try:
            result = transcribe(task, model)
            response = requests.post(str(task.callback_url), json={"job_id": task.job_id, "source_video_id": task.source_video_id, "result": result, "idempotency_key": task.idempotency_key}, timeout=120)
            response.raise_for_status()
            redis.set(result_key, "succeeded")
        except Exception as error:
            redis.set(result_key, json.dumps({"status": "failed", "error": str(error)}), ex=86400)
            raise


if __name__ == "__main__":
    main()
