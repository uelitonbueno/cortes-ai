FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir pydantic==2.11.7 redis==5.2.1 requests==2.32.3
WORKDIR /worker
COPY ingest_worker.py ./
CMD ["python", "ingest_worker.py"]
