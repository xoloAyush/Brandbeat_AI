import os
import re
import uuid
import logging
from pathlib import Path
from threading import Lock

import fitz  # PyMuPDF

from dotenv import load_dotenv
from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    Header,
    HTTPException,
    Depends,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool

from app.config import (
    API_TITLE,
    API_VERSION,
    API_PREFIX,
    POLICY_DIR,
    REVIEW_DIR,
    MAX_UPLOAD_MB,
    validate_environment,
)

load_dotenv(Path(__file__).resolve().parent / ".env")

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("brandbeat.ai")

app = FastAPI(title=API_TITLE, version=API_VERSION)

allowed_origins = [
    x.strip()
    for x in os.getenv(
        "CLIENT_URL",
        "http://localhost:5173"
    ).split(",")
    if x.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-Service-Token",
    ],
)

_engine = None
_engine_error = "AI engine has not initialized yet."
_engine_lock = Lock()
MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024


def verify_service_token(
    x_service_token: str | None = Header(default=None)
):
    expected = os.getenv("AI_SERVICE_TOKEN")

    if not expected:
        raise HTTPException(
            status_code=503,
            detail="Service authentication is not configured."
        )

    if x_service_token != expected:
        raise HTTPException(
            status_code=401,
            detail="Invalid service credentials."
        )

@app.post(
    f"{API_PREFIX}/documents/extract",
    dependencies=[Depends(verify_service_token)]
)
async def extract_document_text(file: UploadFile = File(...)):

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are allowed."
        )

    try:
        content = await file.read()

        if not content:
            raise HTTPException(
                status_code=400,
                detail="Uploaded PDF is empty."
            )

        if len(content) > MAX_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"PDF exceeds {MAX_UPLOAD_MB} MB."
            )

        if not content.startswith(b"%PDF-"):
            raise HTTPException(
                status_code=400,
                detail="Invalid PDF file."
            )

        with fitz.open(stream=content, filetype="pdf") as pdf:

            total_pages = len(pdf)

            extracted_text = "\n\n".join(
                page.get_text("text")
                for page in pdf
            ).strip()

        if not extracted_text:
            raise HTTPException(
                status_code=422,
                detail="No extractable text found in this PDF."
            )

        return {
            "success": True,
            "text": extracted_text,
            "totalPages": total_pages
        }

    except HTTPException:
        raise

    except Exception as exc:
        logger.exception("PDF text extraction failed")

        raise HTTPException(
            status_code=422,
            detail=f"Could not extract PDF text: {str(exc)}"
        )

    finally:
        await file.close()
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are allowed."
        )

    content = await file.read()

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded PDF is empty.")

    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="PDF size cannot exceed 20 MB."
        )

    if not content.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=400,
            detail="Invalid PDF file."
        )

    try:
        with fitz.open(stream=content, filetype="pdf") as pdf:
            total_pages = len(pdf)
            extracted_text = "\n\n".join(
                page.get_text("text") for page in pdf
            ).strip()

        if not extracted_text:
            raise HTTPException(
                status_code=422,
                detail="No extractable text found in this PDF."
            )

        return {
            "success": True,
            "text": extracted_text,
            "totalPages": total_pages
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("PDF text extraction failed")
        raise HTTPException(
            status_code=422,
            detail=f"Could not extract PDF text: {str(exc)}"
        )
    finally:
        await file.close()

@app.on_event("startup")
def startup():
    global _engine, _engine_error
    try:
        validate_environment()
        os.environ.setdefault("OUTPUT_DIR", str(REVIEW_DIR))
        from app.services import engine
        # Verify Qdrant connectivity before marking the service ready.
        engine.qdr.get_collections()
        if engine.qdr.collection_exists(engine.POLICY_COLLECTION):
            engine.load_policy_state()
            logger.info("Restored policy collection %s", engine.POLICY_COLLECTION)
        else:
            logger.warning("No policy indexed yet; upload one before reviewing documents.")
        _engine = engine
        _engine_error = None
    except Exception as exc:
        _engine = None
        _engine_error = str(exc)
        logger.exception("AI service initialization failed")


def require_engine():
    if _engine is None:
        raise HTTPException(status_code=503, detail=f"AI engine is not ready: {_engine_error}")
    return _engine


async def save_pdf(upload: UploadFile, directory: Path) -> Path:
    if not upload.filename or Path(upload.filename).suffix.lower() != ".pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / f"{uuid.uuid4().hex}.pdf"
    size = 0
    try:
        with target.open("wb") as output:
            while True:
                chunk = await upload.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_BYTES:
                    raise HTTPException(status_code=413, detail=f"PDF exceeds {MAX_UPLOAD_MB} MB.")
                output.write(chunk)
        if size < 5:
            raise HTTPException(status_code=400, detail="The uploaded file is empty or invalid.")
        with target.open("rb") as source:
            if source.read(5) != b"%PDF-":
                raise HTTPException(status_code=400, detail="Uploaded file is not a valid PDF.")
        return target
    except Exception:
        target.unlink(missing_ok=True)
        raise
    finally:
        await upload.close()


@app.get(f"{API_PREFIX}/health")
def health():
    return {
        "status": "ok" if _engine else "degraded",
        "service": API_TITLE,
        "engine_ready": _engine is not None,
        "policy_loaded": bool(_engine and _engine.POLICY_STATE.get("version")),
        "engine_error": _engine_error,
    }


@app.post(f"{API_PREFIX}/policies/index", dependencies=[Depends(verify_service_token)])
async def index_policy(file: UploadFile = File(...), policy_name: str = Form("Company Policy")):
    engine = require_engine()
    saved = await save_pdf(file, POLICY_DIR)
    try:
        # Engine and Qdrant clients are synchronous; keep them off the event loop.
        with _engine_lock:
            chunks = await run_in_threadpool(engine.index_policy_pdf, str(saved), policy_name)
        return {
            "message": "Policy indexed successfully.",
            "policy_name": policy_name,
            "policy_version": engine.POLICY_STATE["version"],
            "chunks_indexed": len(chunks),
        }
    except HTTPException:
        saved.unlink(missing_ok=True)
        raise
    except Exception as exc:
        saved.unlink(missing_ok=True)
        logger.exception("Policy indexing failed")
        raise HTTPException(status_code=500, detail=f"Policy indexing failed: {str(exc)}")


@app.post(f"{API_PREFIX}/reviews", dependencies=[Depends(verify_service_token)])
async def review_document(file: UploadFile = File(...), user_name: str = Form("staff")):
    engine = require_engine()
    if not engine.POLICY_STATE.get("version"):
        raise HTTPException(status_code=409, detail="No active policy is indexed. An admin must upload a policy first.")
    saved = await save_pdf(file, REVIEW_DIR)
    try:
        with _engine_lock:
            report = await run_in_threadpool(engine.review_submission_pdf, str(saved), user_name)
        review_id = saved.stem
        artifact_keys = [k for k, v in report.get("artifacts", {}).items() if v]
        report.pop("artifacts", None)  # Do not expose server filesystem paths.
        report["review_id"] = review_id
        report["downloads"] = {
            key: f"{API_PREFIX}/reviews/{review_id}/download/{key}" for key in artifact_keys
        }
        return report
    except Exception as exc:
        logger.exception("Document review failed")
        raise HTTPException(status_code=500, detail=f"Document review failed: {str(exc)}")


@app.get(f"{API_PREFIX}/reviews/{{review_id}}/download/{{artifact}}", dependencies=[Depends(verify_service_token)])
def download_artifact(review_id: str, artifact: str):
    if not re.fullmatch(r"[a-f0-9]{32}", review_id):
        raise HTTPException(status_code=400, detail="Invalid review ID.")
    if artifact not in {"reviewed_pdf", "json", "markdown"}:
        raise HTTPException(status_code=400, detail="Unsupported artifact.")
    artifact_dir = Path(_engine.OUTPUT_DIR) if _engine else REVIEW_DIR
    candidates = list(artifact_dir.glob(f"{review_id}_*"))
    if artifact == "reviewed_pdf":
        candidates = [p for p in candidates if "_REVIEWED_" in p.name and p.suffix == ".pdf"]
    elif artifact == "json":
        candidates = [p for p in candidates if p.suffix == ".json"]
    else:
        candidates = [p for p in candidates if p.suffix == ".md"]
    if not candidates:
        raise HTTPException(status_code=404, detail="Artifact not found.")
    path = max(candidates, key=lambda p: p.stat().st_mtime)
    return FileResponse(path, filename=path.name)
