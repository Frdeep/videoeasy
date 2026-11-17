"""VideoEasy shorts engine on Modal (serverless: nothing runs, nothing is billed, when idle).

Deploy:  modal deploy modal_app.py   (from this folder)
Secret:  modal secret create videoeasy-shorts ENGINE_SECRET=...

Same HTTP contract as app.py (the Docker/Hugging Face variant):
  POST /v1/shorts            -> 202, job queued (idempotent on job_id)
  GET  /v1/jobs/{id}         -> status, clips metadata
  GET  /v1/jobs/{id}/clips/n -> MP4
Job state lives in a modal.Dict, clips in a modal.Volume, purged after 24 h.
"""


import time

import modal

APP_NAME = "videoeasy-shorts"
FONT_URL = "https://github.com/google/fonts/raw/main/ofl/inclusivesans/InclusiveSans%5Bwght%5D.ttf"
KEEP_SECONDS = 24 * 3600


def _download_model() -> None:
    from faster_whisper import WhisperModel

    WhisperModel("small", device="cpu", compute_type="int8")


image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg", "curl", "fontconfig")
    .pip_install("fastapi[standard]==0.115.6", "requests==2.32.3", "faster-whisper==1.1.1", "av==14.2.0")
    .run_commands(f"mkdir -p /app/fonts && curl -fsSL -o /app/fonts/InclusiveSans.ttf '{FONT_URL}'")
    .env({"HF_HOME": "/models"})
    .run_function(_download_model)
    .add_local_python_source("pipeline", "captions")
)

app = modal.App(APP_NAME)
clips_volume = modal.Volume.from_name(f"{APP_NAME}-clips", create_if_missing=True)
jobs = modal.Dict.from_name(f"{APP_NAME}-jobs", create_if_missing=True)
secret = modal.Secret.from_name(APP_NAME)
DATA = "/data"


def _update(job_id: str, **kw) -> None:
    job = jobs.get(job_id) or {}
    job.update(kw, updated_at=time.time())
    jobs[job_id] = job


@app.function(image=image, cpu=4.0, memory=8192, timeout=3600, max_containers=2,
              volumes={DATA: clips_volume})
def process(job_id: str) -> None:
    import shutil
    import tempfile
    import traceback
    from pathlib import Path

    import pipeline

    job = jobs[job_id]
    tmp = Path(tempfile.mkdtemp())
    try:
        src = tmp / "source"
        _update(job_id, status="downloading")
        pipeline.download(job["source_url"], src)
        meta = pipeline.probe(src)
        _update(job_id, status="transcribing", duration=meta["duration"])
        segments, lang = pipeline.transcribe(src)
        if not segments:
            raise ValueError("no speech detected")
        moments = pipeline.pick_moments(segments, job["count"], job["length_s"])
        if not moments:
            raise ValueError("source too short for the requested clip length")
        out_dir = Path(DATA) / job_id
        out_dir.mkdir(parents=True, exist_ok=True)
        clips = []
        for i, m in enumerate(moments):
            _update(job_id, status="rendering", progress=f"{i}/{len(moments)}")
            rendered = pipeline.render(src, meta, m, segments, job["ratio"], job["caption"], tmp, i)
            shutil.copy(rendered, out_dir / f"clip{i}.mp4")
            clips.append({"index": i, "start": round(m.start, 2), "end": round(m.end, 2),
                          "score": round(m.score, 2), "text": m.text[:500]})
        clips_volume.commit()
        _update(job_id, status="succeeded", language=lang, clips=clips, progress=None)
    except Exception as e:  # noqa: BLE001 — reported to the caller
        traceback.print_exc()
        _update(job_id, status="failed", error=str(e)[:300])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


@app.function(image=image, schedule=modal.Period(hours=6), volumes={DATA: clips_volume})
def janitor() -> None:
    import shutil
    from pathlib import Path

    now = time.time()
    for job_id, job in list(jobs.items()):
        if now - job.get("updated_at", now) > KEEP_SECONDS:
            jobs.pop(job_id, None)
            shutil.rmtree(Path(DATA) / job_id, ignore_errors=True)
    clips_volume.commit()


@app.function(image=image, secrets=[secret], volumes={DATA: clips_volume}, max_containers=4)
@modal.asgi_app()
def web():
    import hmac
    import os
    import re
    from pathlib import Path

    from fastapi import Body, Depends, FastAPI, Header, HTTPException
    from fastapi.responses import FileResponse
    from pydantic import BaseModel, Field

    from captions import STYLES

    engine_secret = os.environ.get("ENGINE_SECRET", "")
    job_re = r"^[0-9a-f-]{36}$"
    api = FastAPI(title="VideoEasy shorts engine", docs_url=None, redoc_url=None, openapi_url=None)

    def auth(authorization: str = Header(default="")) -> None:
        if not engine_secret or not hmac.compare_digest(authorization, f"Bearer {engine_secret}"):
            raise HTTPException(401, "unauthorized")

    class ShortsRequest(BaseModel):
        job_id: str = Field(pattern=job_re)
        source_url: str = Field(max_length=4096)
        count: int = Field(ge=1, le=10)
        length_s: int = Field(ge=10, le=90)
        ratio: str = Field(pattern=r"^(9:16|1:1|16:9)$")
        caption: str

    def public(job: dict) -> dict:
        return {k: v for k, v in job.items() if k != "source_url"}

    @api.get("/")
    def health() -> dict:
        return {"ok": True, "configured": bool(engine_secret)}

    @api.post("/v1/shorts", dependencies=[Depends(auth)], status_code=202)
    def create(req: ShortsRequest = Body(...)) -> dict:
        if req.caption not in STYLES:
            raise HTTPException(422, "unknown caption style")
        job = {**req.model_dump(), "status": "queued", "created_at": time.time(), "updated_at": time.time()}
        if not jobs.put(req.job_id, job, skip_if_exists=True):  # idempotent replay
            return public(jobs[req.job_id])
        process.spawn(req.job_id)
        return public(job)

    @api.get("/v1/jobs/{job_id}", dependencies=[Depends(auth)])
    def status(job_id: str) -> dict:
        job = jobs.get(job_id) if re.match(job_re, job_id) else None
        if not job:
            raise HTTPException(404, "unknown job")
        return public(job)

    @api.get("/v1/jobs/{job_id}/clips/{index}", dependencies=[Depends(auth)])
    def clip(job_id: str, index: int) -> FileResponse:
        job = jobs.get(job_id) if re.match(job_re, job_id) else None
        if not job or job.get("status") != "succeeded" or index < 0:
            raise HTTPException(404, "not ready")
        clips_volume.reload()
        path = Path(DATA) / job_id / f"clip{index}.mp4"
        if not path.is_file():
            raise HTTPException(404, "no such clip")
        return FileResponse(path, media_type="video/mp4")

    return api
