import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env")

API_TITLE = "Brandbeat AI Service"
API_VERSION = "1.0.0"
API_PREFIX = "/api/v1"

STORAGE_DIR = Path(os.getenv("STORAGE_DIR", ROOT_DIR / "storage")).expanduser().resolve()
POLICY_DIR = STORAGE_DIR / "policies"
REVIEW_DIR = STORAGE_DIR / "reviews"
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "20"))
if MAX_UPLOAD_MB < 1 or MAX_UPLOAD_MB > 100:
    raise RuntimeError("MAX_UPLOAD_MB must be between 1 and 100.")

POLICY_DIR.mkdir(parents=True, exist_ok=True)
REVIEW_DIR.mkdir(parents=True, exist_ok=True)


def validate_environment():
    required = [
        "COHERE_API_KEY",
        "GROQ_API_KEY",
        "QDRANT_URL",
        "QDRANT_API_KEY",
        "AI_SERVICE_TOKEN",
    ]

    missing = [
        key for key in required
        if not os.getenv(key)
    ]

    if missing:
        raise RuntimeError(
            "Missing environment variables: "
            + ", ".join(missing)
        )
