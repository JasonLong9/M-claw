"""Run a local, OpenAI-compatible audio endpoint with a local faster-whisper model."""

import argparse
import io
from pathlib import Path
from threading import Lock

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from faster_whisper import WhisperModel

MAX_BYTES = 3 * 1024 * 1024


def create_app(model_path: Path) -> FastAPI:
    model = WhisperModel(str(model_path), device="cpu", compute_type="int8", local_files_only=True)
    inference = Lock()
    app = FastAPI()

    @app.post("/v1/audio/transcriptions")
    def transcribe(file: UploadFile = File(...), model_name: str = Form(alias="model")):
        if model_name != "whisper-1":
            raise HTTPException(400, "Set MCLAW_VOICE_MODEL to whisper-1 for this server")
        audio = file.file.read(MAX_BYTES + 1)
        if not audio or len(audio) > MAX_BYTES:
            raise HTTPException(400, "Invalid audio size")
        if not inference.acquire(blocking=False):
            raise HTTPException(429, "Transcription is busy")
        try:
            try:
                segments, _ = model.transcribe(io.BytesIO(audio), beam_size=1)
            except (ValueError, EOFError) as error:
                raise HTTPException(400, "Invalid audio") from error
            return {"text": "".join(segment.text for segment in segments).strip()}
        finally:
            inference.release()

    return app


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", type=Path, required=True)
    parser.add_argument("--port", type=int, default=9000)
    args = parser.parse_args()
    if not (args.model_dir / "model.bin").is_file():
        parser.error("--model-dir must point to an existing faster-whisper model")
    uvicorn.run(create_app(args.model_dir.resolve()), host="127.0.0.1", port=args.port)
