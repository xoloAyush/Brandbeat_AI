
import os
from dotenv import load_dotenv
from qdrant_client import QdrantClient

# Load environment variables from .env
load_dotenv()

# Qdrant configuration
QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY") or None

# Validate configuration
if not QDRANT_URL:
    raise ValueError("QDRANT_URL is missing from environment variables")

# Initialize Qdrant client
qdrant_client = QdrantClient(
    url=QDRANT_URL,
    api_key=QDRANT_API_KEY
)
