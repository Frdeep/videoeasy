"""VideoEasy shorts engine — HTTP API for a Hugging Face Docker Space.

Only VideoEasy's server calls it, with `Authorization: Bearer $ENGINE_SECRET`.
Jobs run one at a time (free CPU tier). Results stay on the Space's disk until
VideoEasy downloads them into its own storage; a Space restart loses them, so
VideoEasy must treat a vanished job as failed and release the user's quota.
"""

from __future__ import annotations

import hmac
import json
import os
import queue
import re
import shutil
import threading
import time
import traceback
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

import pipeline
from captions import STYLES

SECRET = os.environ.get("ENGINE_SECRET", "")
WORK = Path(os.environ.get("WORK_DIR", "/tmp/jobs"))
WORK.mkdir(parents=True, exist_ok=True)
KEEP_SECONDS = 6 * 3600
JOB_ID = re.compile(r"^[0-9a-f-]{36}$")

app = FastAPI(title="VideoEasy shorts engine", docs_url=None, redoc_url=None)
jobs: dict[str, dict] = {}
lock = threading.Lock()
todo: "queue.Queue[str]" = queue.Queue()


def auth(authorization: str = Header(default="")) -> None:
    # Fail closed: without a configured secret nobody gets in.
    if not SECRET or not hmac.compare_digest(authorization, f"Bearer {SECRET}"):
        raise HTTPException(status_code=401, detail="unauthorized")


class ShortsRequest(BaseModel):
    job_id: str = Field(pattern=JOB_ID.pattern)
    source_url: str = Field(max_length=4096)
    count: int = Field(ge=1, le=10)
    length_s: int = Field(ge=10, le=90)
    ratio: str = Field(pattern=r"^(9:16|1:1|16:9)$")
    caption: str


def _public(job: dict) -> dict:
    return {k: v for k, v in job.items() if k != "source_url"}


def _set(job_id: str, **kw) -> None:
    with lock:
        jobs[job_id].update(kw, updated_at=time.time())


def worker() -> None:
    while True:
        job_id = todo.get()
        job = jobs[job_id]
        wd = WORK / job_id
        wd.mkdir(exist_ok=True)
        try:
            src = wd / "source"
            _set(job_id, status="downloading")
            pipeline.download(job["source_url"], src)
            meta = pipeline.probe(src)
            _set(job_id, status="transcribing", duration=meta["duration"])
            segments, lang = pipeline.transcribe(src)
            if not segments:
                raise ValueError("no speech detected")
            moments = pipeline.pick_moments(segments, job["count"], job["length_s"])
            if not moments:
                raise ValueError("source too short for the requested clip length")
            clips = []
            for i, m in enumerate(moments):
                _set(job_id, status="rendering", progress=f"{i}/{len(moments)}")
                pipeline.render(src, meta, m, segments, job["ratio"], job["caption"], wd, i)
                clips.append({"index": i, "start": round(m.start, 2), "end": round(m.end, 2),
                              "score": round(m.score, 2), "text": m.text[:500]})
            src.unlink(missing_ok=True)
            _set(job_id, status="succeeded", language=lang, clips=clips, progress=None)
        except Exception as e:  # noqa: BLE001 — report any failure to the caller
            traceback.print_exc()
            _set(job_id, status="failed", error=str(e)[:300])
            (wd / "source").unlink(missing_ok=True)


def janitor() -> None:
    while True:
        time.sleep(600)
        now = time.time()
        with lock:
            old = [k for k, j in jobs.items()
                   if j["status"] in ("succeeded", "failed") and now - j["updated_at"] > KEEP_SECONDS]
            for k in old:
                jobs.pop(k, None)
        for k in old:
            shutil.rmtree(WORK / k, ignore_errors=True)


threading.Thread(target=worker, daemon=True).start()
threading.Thread(target=janitor, daemon=True).start()


@app.get("/")
def health() -> dict:
    return {"ok": True, "queued": todo.qsize(), "configured": bool(SECRET)}


@app.post("/v1/shorts", dependencies=[Depends(auth)], status_code=202)
def create(req: ShortsRequest) -> dict:
    if req.caption not in STYLES and req.caption != "none":
        raise HTTPException(422, "unknown caption style")
    with lock:
        if req.job_id in jobs:  # idempotent replay
            return _public(jobs[req.job_id])
        jobs[req.job_id] = {**json.loads(req.model_dump_json()), "status": "queued",
                            "created_at": time.time(), "updated_at": time.time()}
    todo.put(req.job_id)
    return _public(jobs[req.job_id])


@app.get("/v1/jobs/{job_id}", dependencies=[Depends(auth)])
def status(job_id: str) -> dict:
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(404, "unknown job (engine may have restarted)")
    return _public(job)


@app.get("/v1/jobs/{job_id}/clips/{index}", dependencies=[Depends(auth)])
def clip(job_id: str, index: int) -> FileResponse:
    job = jobs.get(job_id)
    if not job or not JOB_ID.match(job_id) or job["status"] != "succeeded":
        raise HTTPException(404, "not ready")
    path = WORK / job_id / f"clip{index}.mp4"
    if index < 0 or not path.is_file():
        raise HTTPException(404, "no such clip")
    return FileResponse(path, media_type="video/mp4")
