FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg curl fontconfig \
    && rm -rf /var/lib/apt/lists/*
RUN useradd -m -u 1000 user
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN mkdir -p /app/fonts && curl -fsSL -o /app/fonts/InclusiveSans.ttf \
    "https://github.com/google/fonts/raw/main/ofl/inclusivesans/InclusiveSans%5Bwght%5D.ttf"
COPY --chown=user . .
USER user
ENV HOME=/home/user WORK_DIR=/tmp/jobs HF_HOME=/tmp/hf
# Pre-download the Whisper model so the first job does not wait for it.
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')" || true
EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
