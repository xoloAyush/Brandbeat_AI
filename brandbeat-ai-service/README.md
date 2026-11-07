# Brandbeat AI Service

FastAPI wrapper around the Brandbeat policy-compliance RAG engine extracted from `09_policy_compliance_checker.ipynb`.

## Included functionality

- PDF text extraction and section-aware statement splitting (scanned PDFs need OCR first).
- Cohere `embed-v4.0` embeddings and Qdrant dense + BM25 hybrid retrieval with RRF.
- Groq statement-level verdicts and document-level missing-item checks.
- Verdict cache keyed by policy version and statement hash.
- Highlighted PDF (when findings exist), JSON report, and Markdown report.
- Upload size/type checks, readiness endpoint, optional service-token protection, and download endpoints.

The engine intentionally supports **one active policy collection**, matching the source notebook. It is not a multi-tenant production system yet.

## 1. Folder placement

Place `ai-service` beside your existing `backend` and `frontend` folders:

```text
rag_fullstack/
├── frontend/
├── backend/
└── ai-service/
    ├── app/
    ├── storage/
    ├── main.py
    ├── requirements.txt
    └── .env
```

## 2. Configure Qdrant and keys

PowerShell:

```powershell
cd path\to\rag_fullstack\ai-service
copy .env.example .env
notepad .env
```

Set `COHERE_API_KEY` and `GROQ_API_KEY`. Keep `.env` private and out of Git.

Run Qdrant locally if you do not already have an instance:

```powershell
docker run -d --name brandbeat-qdrant -p 6333:6333 -p 6334:6334 -v brandbeat_qdrant_data:/qdrant/storage qdrant/qdrant
```

If the container already exists, reuse it; do not create another one. Set `QDRANT_URL` to the reachable Qdrant URL.

For production, set a long random `AI_SERVICE_TOKEN`. Express must pass it as `X-Service-Token`. Leave it unset only for local development. Do not expose this service directly to the public internet.

## 3. Install and run (Python 3.12 recommended)

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8001
```

- Health: <http://127.0.0.1:8001/api/v1/health>
- Swagger: <http://127.0.0.1:8001/docs>

`engine_ready: true` means keys and Qdrant connection initialized. `policy_loaded: true` means a policy is available for review. Upload a policy before attempting a review.

## 4. API endpoints

### Index/replace the active policy

`POST /api/v1/policies/index` (multipart form)

- `file`: policy PDF
- `policy_name`: human-readable policy name
- Header: `X-Service-Token` if `AI_SERVICE_TOKEN` is configured

This replaces the configured Qdrant collection, just like the original single-policy notebook workflow.

### Review a marketing/content PDF

`POST /api/v1/reviews` (multipart form)

- `file`: PDF to review
- `user_name`: optional staff identifier
- Header: `X-Service-Token` if configured

The response contains findings and relative download URLs. A missing active policy returns HTTP 409. A scanned PDF without extractable text returns HTTP 400 with an OCR explanation.

### Download artifacts

`GET /api/v1/reviews/{review_id}/download/{artifact}`

`artifact` is `reviewed_pdf`, `json`, or `markdown`. The reviewed PDF is only available when there are findings.

## 5. Connect from Express (server-to-server)

Install `axios` and `form-data` in your existing Node backend if not already present. Example service helper:

```js
// backend/src/services/aiService.js
import axios from "axios";
import FormData from "form-data";
import fs from "node:fs";

const AI_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8001/api/v1";

export async function indexPolicyWithAI(filePath, policyName) {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath));
  form.append("policy_name", policyName);
  const { data } = await axios.post(`${AI_URL}/policies/index`, form, {
    headers: { ...form.getHeaders(), "X-Service-Token": process.env.AI_SERVICE_TOKEN },
    maxBodyLength: Infinity,
    timeout: 10 * 60 * 1000,
  });
  return data;
}

export async function reviewPdfWithAI(filePath, userName) {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath));
  form.append("user_name", userName || "staff");
  const { data } = await axios.post(`${AI_URL}/reviews`, form, {
    headers: { ...form.getHeaders(), "X-Service-Token": process.env.AI_SERVICE_TOKEN },
    maxBodyLength: Infinity,
    timeout: 10 * 60 * 1000,
  });
  return data;
}
```

Add to the **backend** `.env` (use the same token value as the AI service):

```env
AI_SERVICE_URL=http://127.0.0.1:8001/api/v1
AI_SERVICE_TOKEN=the_same_long_random_secret
```

Call these helpers only after Express has authenticated the user and checked the user's role. Only admins should index policies; authorized staff/reviewers may submit content. Never trust a `user_name` supplied by the browser; derive it from the authenticated session.

## 6. Important behavior and limitations

- `COMPLIANT`, `VIOLATION`, `UNVERIFIED`, and `NEEDS_HUMAN_REVIEW` retain the source engine's meanings. Missing evidence is not automatically treated as false.
- A report with `not_checked > 0` or `doc_check_failed: true` is incomplete and must not be presented as approved.
- Only one active policy is supported. Tenant isolation, MongoDB policy metadata synchronization, background jobs, OCR, and production-grade observability are not included.
- The service serializes policy indexing and reviews within one process to avoid replacing the policy collection mid-review. Run one worker until a distributed job/locking design is added.
- Store `storage/` on a persistent volume in deployment. The verdict cache and reports are local files.
- Python syntax checks do not prove external API connectivity or compliance accuracy. Test with your real policy and sample submissions before using results operationally.

## 7. Troubleshooting

- `engine_ready: false`: inspect `engine_error`; check API keys and Qdrant availability.
- `policy_loaded: false`: upload a policy using the index endpoint.
- `No text found`: PDF is likely scanned/image-only; OCR it before upload.
- Groq/Cohere rate limits or timeouts: retry after checking provider quota and model access. Do not treat failed checks as approval.
