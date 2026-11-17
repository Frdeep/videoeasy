---
title: VideoEasy Shorts Engine
emoji: 🎬
colorFrom: yellow
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

Moteur privé de découpage en shorts de VideoEasy (FFmpeg + faster-whisper).
Appelé uniquement par le serveur VideoEasy avec le secret `ENGINE_SECRET`
(à définir dans *Settings → Variables and secrets* du Space).

API : `POST /v1/shorts`, `GET /v1/jobs/{id}`, `GET /v1/jobs/{id}/clips/{n}`.
