import os
import re
import json
import time
import hashlib
from datetime import datetime
from dotenv import load_dotenv

import pymupdf

load_dotenv()



QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")

POLICY_COLLECTION = os.getenv(
    "POLICY_COLLECTION",
    "company_policy_kb_v2"
)

if not QDRANT_URL:
    raise ValueError("QDRANT_URL is missing")

if not QDRANT_URL.startswith("https://"):
    raise ValueError("Qdrant Cloud requires HTTPS")


EMBED_MODEL = "embed-v4.0"
LLM_MODEL = "openai/gpt-oss-20b"
PROMPT_VERSION = "v2"            # change when you edit the prompts -> cached verdicts are refreshed

POLICY_MAX_CHUNK_CHARS = 1200    # long policy sections are split into pieces of this size
TOP_K_POLICY = 3                 # policy excerpts retrieved per statement
UNITS_PER_CALL = 6               # statements judged per LLM call
MAX_CONTEXT_CHARS = 9000         # cap on policy text sent per LLM call
SLEEP_BETWEEN_CALLS = 0.0        # raise (e.g. 2.0) if Groq rate-limits you

USE_VISUAL_REVIEW = False                # True: also send pages that contain embedded images to a vision model
VISION_MODEL = "command-a-vision-07-2025"
SERVICE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUTPUT_DIR = os.getenv("OUTPUT_DIR", os.path.join(SERVICE_ROOT, "storage", "reviews"))
CACHE_PATH = os.path.join(OUTPUT_DIR, "verdict_cache.json")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Always-on policy context, retrieved once per policy (tone, banned wording, claims register, risk table...)
GLOBAL_RULE_QUERIES = [
    "writing rules absolute guarantees always never 100% risk-free",
    "approved claims register claim ID approved wording evidence limitation",
    "claims requiring evidence performance security comparative customer",
    "mandatory disclosures pricing renewal eligibility trial",
    "logo brand assets colour typography accessibility contrast",
    "risk levels low medium high required action",
]

# Queries used for the one-per-document "missing items" check
DOC_CHECK_QUERIES = [
    "mandatory disclosures pricing renewal eligibility trial conditions",
    "customer testimonials permission evidence case study",
    "approved logos brand assets visual identity",
    "review approval workflow product owner legal sign-off",
]

# Deterministic wording floor: statements containing these can never silently pass as COMPLIANT.
# Taken from the policy rule "avoid absolute guarantees such as always, never, 100% secure, risk-free, guaranteed results".
ABSOLUTE_RE = re.compile(r"\b(?:always|never|risk[- ]free|guarantee[sd]?|guaranteed)\b|100\s?%", re.IGNORECASE)

# ---- The two PDFs ----
PRIMARY_POLICY_PDF = r"C:\Users\opsin\OneDrive\Documents\Company_Policy.pdf"   # uploaded by the ADMIN
CHECK_PDF = r"C:\Users\opsin\OneDrive\Documents\Staff_Content.pdf"            # uploaded by STAFF

from langchain_cohere import CohereEmbeddings
from langchain_groq import ChatGroq
from qdrant_client import QdrantClient, models

embeddings = CohereEmbeddings(model=EMBED_MODEL, cohere_api_key=os.getenv("COHERE_API_KEY"))
qdr = QdrantClient(
    url=QDRANT_URL,
    api_key=QDRANT_API_KEY,
    timeout=30
)
llm = ChatGroq(model=LLM_MODEL, temperature=0, max_tokens=6000)



def normalize(s):
    return " ".join((s or "").split())


def short_hash(s):
    return hashlib.sha1(normalize(s).lower().encode("utf-8")).hexdigest()[:10]


def extract_page_blocks(pdf_path):
    """Return [(page_index, [(x0, y0, x1, y1, text), ...]), ...] with repeated headers/footers removed."""
    doc = pymupdf.open(pdf_path)
    pages = []
    for page in doc:
        blocks = []
        for b in page.get_text("blocks"):
            x0, y0, x1, y1, text, _, btype = b[:7]
            if btype == 0 and text.strip():
                blocks.append((x0, y0, x1, y1, text.strip()))

        # reading order: top to bottom, cells on the same row left to right
        blocks.sort(key=lambda b: (b[1], b[0]))
        rows = []
        for b in blocks:
            if rows and abs(b[1] - rows[-1][0][1]) <= 3:
                rows[-1].append(b)
            else:
                rows.append([b])
        ordered = [b for row in rows for b in sorted(row, key=lambda b: b[0])]
        pages.append((page.rect.height, ordered))
    doc.close()

    def edge_key(t):
        return re.sub(r"\d+", "#", normalize(t)).lower()

    def in_margin(b, h):
        return b[3] < h * 0.06 or b[1] > h * 0.94

    counts = {}
    for h, blocks in pages:
        seen = set()
        for b in blocks:
            if in_margin(b, h):
                k = edge_key(b[4])
                if k not in seen:
                    seen.add(k)
                    counts[k] = counts.get(k, 0) + 1

    min_pages = max(2, (len(pages) + 1) // 2)
    repeated = {k for k, c in counts.items() if c >= min_pages}

    result = []
    for pno, (h, blocks) in enumerate(pages):
        kept = [b for b in blocks if not (in_margin(b, h) and edge_key(b[4]) in repeated)]
        result.append((pno, kept))
    return result


BULLET_RE = re.compile(r"^(?:[•●▪◦*]|[-–]\s)\s*")
SENT_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z“\"‘'(])")


def is_heading(text):
    t = normalize(text)
    words = t.split()
    if "\n" in text.strip() and len(text.strip().split("\n")) > 2:
        return False
    if not (1 <= len(words) <= 7):
        return False
    if re.search(r"[.!?:;,”\"]$", t):
        return False
    if BULLET_RE.match(t) or t.startswith(("“", "\"", "—", "–")):
        return False
    return True


def build_units(pdf_path):
    """Split the document into statements: [{id, page, section, text, hash}, ...]."""
    units, heading = [], ""
    for pno, blocks in extract_page_blocks(pdf_path):
        for (_, _, _, _, text) in blocks:
            if is_heading(text):
                heading = normalize(text)
                continue

            paragraphs, current = [], []
            for line in text.split("\n"):
                s = line.strip()
                if not s:
                    continue
                if BULLET_RE.match(s) and current:
                    paragraphs.append(" ".join(current))
                    current = []
                current.append(BULLET_RE.sub("", s))
            if current:
                paragraphs.append(" ".join(current))

            for para in paragraphs:
                for sent in SENT_SPLIT.split(normalize(para)):
                    sent = sent.strip()
                    if len(sent.split()) < 3:
                        continue
                    units.append({
                        "id": f"U{len(units) + 1:03d}",
                        "page": pno,
                        "section": heading,
                        "text": sent,
                        "hash": short_hash(sent),
                    })
    return units

HEADING_RE = re.compile(
    r"^(?:(?P<num>\d{1,2}(?:\.\d{1,2})?)\.?\s+(?P<title>[A-Z][^\n]{2,90})"
    r"|(?P<app>Appendix\s+[A-Z])\s*[—–-]\s*(?P<atitle>.+))$"
)


def build_policy_chunks(pdf_path, max_chars=POLICY_MAX_CHUNK_CHARS):
    lines = []                                   # (page, line)
    for pno, blocks in extract_page_blocks(pdf_path):
        for b in blocks:
            for ln in b[4].split("\n"):
                if ln.strip():
                    lines.append((pno, ln.strip()))

    chunks = []
    cur = {"section": "0", "title": "Front matter"}
    buf = []                                     # [(page, line)]

    def emit(piece):
        if not piece:
            return
        page = piece[0][0]
        text = "\n".join(l for _, l in piece)
        if cur["section"] == "0":
            ref = f"{cur['title']} (p.{page + 1})"
        else:
            ref = f"§{cur['section']} {cur['title']} (p.{page + 1})"
        chunks.append({
            "chunk_id": f"P{len(chunks) + 1:03d}",
            "section": cur["section"],
            "title": cur["title"],
            "page": page,
            "reference": ref,
            "text": text,
        })

    def flush():
        nonlocal buf
        piece, size = [], 0
        for item in buf:
            if size + len(item[1]) > max_chars and piece:
                emit(piece)
                piece, size = [], 0
            piece.append(item)
            size += len(item[1]) + 1
        emit(piece)
        buf = []

    for pno, ln in lines:
        m = HEADING_RE.match(ln)
        if m:
            # a heading directly followed by a sub-heading (e.g. "4." then "4.1") is carried into the next chunk
            if not (len(buf) == 1 and HEADING_RE.match(buf[0][1])):
                flush()
            if m.group("num"):
                cur = {"section": m.group("num"), "title": normalize(m.group("title"))}
            else:
                cur = {"section": m.group("app"), "title": normalize(m.group("atitle"))}
        buf.append((pno, ln))
    flush()
    return chunks

POLICY_STATE = {"name": None, "version": None, "refs": {}, "global_points": []}


def hybrid_search(query, limit=TOP_K_POLICY):
    """Dense + BM25 over the policy knowledge base, fused with RRF."""
    dense_query = embeddings.embed_query(query)
    prefetch_limit = max(limit * 3, 10)
    response = qdr.query_points(
        collection_name=POLICY_COLLECTION,
        prefetch=[
            models.Prefetch(query=dense_query, using="dense", limit=prefetch_limit),
            models.Prefetch(
                query=models.Document(text=query, model="Qdrant/bm25"),
                using="bm25",
                limit=prefetch_limit,
            ),
        ],
        query=models.RrfQuery(rrf=models.Rrf()),
        limit=limit,
        with_payload=True,
    )
    return response.points


def _set_policy_state(chunks, source):
    version_src = "".join(c["text"] for c in chunks) + LLM_MODEL + PROMPT_VERSION
    POLICY_STATE["name"] = source
    POLICY_STATE["version"] = hashlib.sha1(version_src.encode("utf-8")).hexdigest()[:10]
    POLICY_STATE["refs"] = {c["chunk_id"]: c["reference"] for c in chunks}

    seen, points = set(), []
    for q in GLOBAL_RULE_QUERIES:
        for p in hybrid_search(q, limit=2):
            cid = p.payload["chunk_id"]
            if cid not in seen:
                seen.add(cid)
                points.append(p)
    POLICY_STATE["global_points"] = points


def admin_upload_policy(pdf_path, replace=True, policy_name=None):
    """ADMIN: load the PRIMARY PDF and build the policy knowledge base."""
    if not os.path.isfile(pdf_path):
        raise FileNotFoundError(f"Policy PDF not found: {pdf_path}")

    chunks = build_policy_chunks(pdf_path)
    if not chunks:
        raise ValueError("No text found in the policy PDF (scanned PDF? it needs OCR first).")

    vectors = embeddings.embed_documents([f"{c['reference']}\n{c['text']}" for c in chunks])
    dim = len(vectors[0])

    if replace and qdr.collection_exists(POLICY_COLLECTION):
        qdr.delete_collection(POLICY_COLLECTION)
    if not qdr.collection_exists(POLICY_COLLECTION):
        qdr.create_collection(
            collection_name=POLICY_COLLECTION,
            vectors_config={"dense": models.VectorParams(size=dim, distance=models.Distance.COSINE)},
            sparse_vectors_config={"bm25": models.SparseVectorParams(modifier=models.Modifier.IDF)},
        )

    source = (policy_name or os.path.basename(pdf_path)).strip() or os.path.basename(pdf_path)
    start_id = qdr.count(POLICY_COLLECTION, exact=True).count
    points = []
    for i, c in enumerate(chunks):
        searchable = f"{c['reference']}\n{c['text']}"
        points.append(models.PointStruct(
            id=start_id + i,
            vector={"dense": vectors[i], "bm25": models.Document(text=searchable, model="Qdrant/bm25")},
            payload={**c, "source": source},
        ))
    qdr.upsert(collection_name=POLICY_COLLECTION, points=points)

    _set_policy_state([{**c, "source": source} for c in chunks], source)
    return chunks


def load_policy_state():
    """Reload the policy a previous session/admin stored in Qdrant (no re-upload needed)."""
    if not qdr.collection_exists(POLICY_COLLECTION):
        raise RuntimeError("No policy found. The admin must run admin_upload_policy() first.")
    payloads, offset = [], None
    while True:
        batch, offset = qdr.scroll(
            collection_name=POLICY_COLLECTION, limit=256, offset=offset,
            with_payload=True, with_vectors=False,
        )
        payloads.extend(p.payload for p in batch)
        if offset is None:
            break
    if not payloads:
        raise RuntimeError("The policy collection is empty. Upload a policy PDF again.")
    payloads.sort(key=lambda c: c["chunk_id"])
    _set_policy_state(payloads, payloads[0].get("source", "policy"))


def ensure_policy_loaded():
    if POLICY_STATE["version"] is None:
        load_policy_state()

CATEGORIES = {
    # HIGH - policy section 12
    "absolute_guarantee": "high",
    "unsupported_performance_claim": "high",
    "unsupported_security_claim": "high",
    "fabricated_or_unverified_testimonial": "high",
    "false_or_unconfirmed_product_capability": "high",
    "misleading_comparison": "high",
    "missing_or_misleading_disclosure": "high",
    "logo_or_brand_asset_misuse": "high",
    "confidential_or_personal_data": "high",
    # MEDIUM
    "ambiguous_product_wording": "medium",
    "incomplete_qualification": "medium",
    "unclear_source_or_evidence": "medium",
    "terminology_issue": "medium",
    "visual_or_accessibility_standard": "medium",
    "missing_approval_or_evidence_record": "medium",
    # LOW
    "tone_or_formatting": "low",
}
STATUSES = {"COMPLIANT", "VIOLATION", "UNVERIFIED", "NEEDS_HUMAN_REVIEW"}
SCOPES = {"public_copy", "design_instruction", "internal_note"}
SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}
NEXT_STEP = {
    "high": "Do not publish. Escalate to Legal/Compliance and the relevant owner.",
    "medium": "Hold publication until brand/product owner review.",
    "low": "Creator may correct; brand reviewer confirms if required.",
}

VERDICT_CACHE = {}
if os.path.isfile(CACHE_PATH):
    try:
        with open(CACHE_PATH, encoding="utf-8") as f:
            VERDICT_CACHE = json.load(f)
    except Exception:
        VERDICT_CACHE = {}


def save_cache():
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(VERDICT_CACHE, f, ensure_ascii=False)


def clear_cache():
    """Forget all stored verdicts (use after editing prompts/policy or to force a fresh judgement)."""
    VERDICT_CACHE.clear()
    save_cache()


def extract_json(raw):
    """Parse JSON from an LLM answer, tolerating code fences and extra text."""
    if not raw:
        return {}
    raw = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.M).strip()
    try:
        return json.loads(raw)
    except Exception:
        pass
    m = re.search(r"\{.*\}", raw, re.S)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            return {}
    return {}


def call_llm(prompt, retries=4):
    for attempt in range(retries):
        try:
            return llm.invoke(prompt).content
        except Exception as e:
            wait = 2 ** (attempt + 1)
            print(f"LLM error ({str(e)[:120]}) - retrying in {wait}s")
            time.sleep(wait)
    return None


def format_excerpt(point):
    p = point.payload
    return f"[{p['chunk_id']}] {p['reference']}\n{p['text']}"


def collect_context(units):
    """Policy excerpts for a batch: per-statement hybrid hits first, then the always-on context."""
    ordered, seen = [], set()
    for u in units:
        for p in hybrid_search(u["text"], limit=TOP_K_POLICY):
            if p.payload["chunk_id"] not in seen:
                seen.add(p.payload["chunk_id"])
                ordered.append(p)
    for p in POLICY_STATE["global_points"]:
        if p.payload["chunk_id"] not in seen:
            seen.add(p.payload["chunk_id"])
            ordered.append(p)

    parts, allowed, size = [], set(), 0
    for p in ordered:
        block = format_excerpt(p)
        if size + len(block) > MAX_CONTEXT_CHARS and parts:
            break
        parts.append(block)
        allowed.add(p.payload["chunk_id"])
        size += len(block)
    return "\n\n".join(parts), allowed


def build_verdict_prompt(batch, excerpts):
    statements = "\n".join(
        f"{u['id']} | page {u['page'] + 1} | section: {u['section'] or '-'} | \"{u['text']}\""
        for u in batch
    )
    return (
        "You are a compliance reviewer. Judge EVERY numbered STATEMENT from a staff document against the "
        "COMPANY POLICY excerpts.\n"
        "Return one verdict per statement id, in order. Do not skip any id.\n\n"
        "Fields:\n"
        "- scope: \"public_copy\" (text meant for the audience), \"design_instruction\" (instructions about logos, "
        "fonts, colours, layout, contrast or assets) or \"internal_note\" (notes about the draft itself: testing "
        "notes, review requests, status, approvals, metadata). An internal_note is never a violation.\n"
        "- status: \"COMPLIANT\"; \"VIOLATION\" (clearly conflicts with an explicit policy rule or with an approved "
        "claim); \"UNVERIFIED\" (a specific factual, performance, security, comparative or customer claim with no "
        "supporting evidence in the excerpts - unverified does NOT mean false); \"NEEDS_HUMAN_REVIEW\" (ambiguous "
        "or risky, a specialist must decide).\n"
        f"- category (required unless COMPLIANT), one of: {', '.join(CATEGORIES)}.\n"
        "- policy_chunk_id: the id (like P007) of the excerpt that supports your verdict. Use only ids shown below.\n"
        "- phrase: the shortest exact phrase copied from the statement that is the problem (may be empty).\n"
        "- why: one sentence. suggested_fix: a rewrite or action that keeps the writer's intent.\n\n"
        "Rules:\n"
        "- Judge only what the statement says. Never flag a statement for something that is absent from it.\n"
        "- The policy excerpts are the only source of truth. Do not use outside knowledge.\n"
        "- Compare factual statements with the approved claims register in the excerpts. A statement that conflicts "
        "with an approved claim (for example different support hours) is a VIOLATION.\n"
        "- A statement that matches approved wording, or already contains an appropriate qualification, is COMPLIANT.\n"
        "- Advisory wording in the policy (\"where practical\", \"should\") is not a reason to flag.\n"
        "- For COMPLIANT statements leave category, policy_chunk_id, phrase, why and suggested_fix empty.\n\n"
        "Return ONLY this JSON (no other text):\n"
        "{\"verdicts\": [{\"id\": \"U001\", \"scope\": \"public_copy\", \"status\": \"COMPLIANT\", \"category\": \"\", "
        "\"policy_chunk_id\": \"\", \"phrase\": \"\", \"why\": \"\", \"suggested_fix\": \"\"}]}\n\n"
        f"COMPANY POLICY excerpts:\n{excerpts}\n\n"
        f"STATEMENTS:\n{statements}\n"
    )


_REF_CACHE = {}


def policy_chunk_for(query):
    if query not in _REF_CACHE:
        hits = hybrid_search(query, limit=1)
        _REF_CACHE[query] = hits[0].payload["chunk_id"] if hits else ""
    return _REF_CACHE[query]


def clean_verdict(v, unit, allowed_ids):
    """Validate/normalise one LLM verdict and apply the deterministic wording floor."""
    scope = str(v.get("scope", "public_copy")).strip().lower()
    if scope not in SCOPES:
        scope = "public_copy"

    status = str(v.get("status", "NEEDS_HUMAN_REVIEW")).strip().upper().replace(" ", "_")
    if status not in STATUSES:
        status = "NEEDS_HUMAN_REVIEW"
    if scope == "internal_note":
        status = "COMPLIANT"

    category = str(v.get("category", "")).strip()
    if status != "COMPLIANT" and category not in CATEGORIES:
        category = "ambiguous_product_wording"
    if status == "COMPLIANT":
        category = ""

    chunk_id = str(v.get("policy_chunk_id", "")).strip()
    if chunk_id not in allowed_ids:
        chunk_id = ""

    phrase = normalize(str(v.get("phrase", "")))
    if phrase and phrase.lower() not in unit["text"].lower():
        phrase = ""

    out = {
        "scope": scope,
        "status": status,
        "category": category,
        "policy_chunk_id": chunk_id,
        "phrase": phrase,
        "why": normalize(str(v.get("why", ""))),
        "suggested_fix": normalize(str(v.get("suggested_fix", ""))),
    }

    # Deterministic floor: absolute wording can never silently pass.
    m = ABSOLUTE_RE.search(unit["text"])
    if m and scope != "internal_note" and status == "COMPLIANT":
        out.update(
            status="NEEDS_HUMAN_REVIEW",
            category="absolute_guarantee",
            phrase=m.group(0),
            policy_chunk_id=policy_chunk_for("avoid absolute guarantees such as always never 100% secure risk-free"),
            why=f"Contains absolute wording ('{m.group(0)}'); the policy allows absolute guarantees only when "
                "explicitly approved and substantiated.",
            suggested_fix="Rephrase without the absolute wording, or attach approved evidence.",
        )
    return out


def _judge(batch):
    excerpts, allowed = collect_context(batch)
    raw = call_llm(build_verdict_prompt(batch, excerpts))
    if raw is None:
        return {}
    data = extract_json(raw)
    items = data.get("verdicts", []) if isinstance(data, dict) else data
    by_id = {u["id"]: u for u in batch}
    result = {}
    for v in items if isinstance(items, list) else []:
        if isinstance(v, dict) and v.get("id") in by_id:
            result[v["id"]] = clean_verdict(v, by_id[v["id"]], allowed)
    return result


def judge_batch(batch):
    """Verdicts for every unit in the batch; units the model skipped are retried alone once."""
    out = _judge(batch)
    for u in batch:
        if u["id"] not in out:
            out.update(_judge([u]))
    return out

DOC_CATEGORIES = {"missing_or_misleading_disclosure", "missing_approval_or_evidence_record", "incomplete_qualification"}


def build_doc_prompt(doc_text, excerpts):
    return (
        "You are a compliance reviewer. Using ONLY the COMPANY POLICY excerpts, list MANDATORY items that are MISSING "
        "from the staff document below.\n"
        "Report an item only if the document contains content that triggers the requirement (for example: offers, "
        "trials or pricing -> required conditions/disclosures; testimonials or customer claims -> permission and "
        "evidence records; logos or visuals -> approved assets; publication -> required approvals). "
        "If the document itself says an item is pending or missing, still report it once.\n"
        "Do not repeat the same missing item. Do not judge individual sentences.\n"
        f"- category: one of {', '.join(sorted(DOC_CATEGORIES))}.\n"
        "- policy_chunk_id: id (like P007) of the supporting excerpt.\n\n"
        "Return ONLY this JSON:\n"
        "{\"missing\": [{\"item\": \"...\", \"category\": \"...\", \"policy_chunk_id\": \"...\", "
        "\"why\": \"...\", \"suggested_fix\": \"...\"}]}\n"
        "If nothing is missing return {\"missing\": []}.\n\n"
        f"COMPANY POLICY excerpts:\n{excerpts}\n\n"
        f"STAFF DOCUMENT:\n{doc_text}\n"
    )


def document_level_findings(units, verdicts):
    """One LLM call per document (cached by content) for missing mandatory items."""
    text = "\n".join(
        u["text"] for u in units
        if verdicts.get(u["hash"]) and verdicts[u["hash"]]["scope"] != "internal_note"
    )[:12000]
    if not text.strip():
        return []

    key = f"{POLICY_STATE['version']}|DOC|{short_hash(text)}"
    if key in VERDICT_CACHE:
        items = VERDICT_CACHE[key]
    else:
        seen, parts, allowed = set(), [], set()
        for q in DOC_CHECK_QUERIES:
            for p in hybrid_search(q, limit=2):
                cid = p.payload["chunk_id"]
                if cid not in seen:
                    seen.add(cid)
                    parts.append(format_excerpt(p))
                    allowed.add(cid)
        raw = call_llm(build_doc_prompt(text, "\n\n".join(parts)[:MAX_CONTEXT_CHARS]))
        if raw is None:
            return None
        data = extract_json(raw)
        raw_items = data.get("missing", []) if isinstance(data, dict) else []
        items = []
        for it in raw_items if isinstance(raw_items, list) else []:
            if not isinstance(it, dict) or not normalize(str(it.get("item", ""))):
                continue
            category = str(it.get("category", "")).strip()
            if category not in DOC_CATEGORIES:
                category = "missing_approval_or_evidence_record"
            cid = str(it.get("policy_chunk_id", "")).strip()
            items.append({
                "item": normalize(str(it["item"])),
                "category": category,
                "policy_chunk_id": cid if cid in allowed else "",
                "why": normalize(str(it.get("why", ""))),
                "suggested_fix": normalize(str(it.get("suggested_fix", ""))),
            })
        VERDICT_CACHE[key] = items
        save_cache()

    findings, seen_items = [], set()
    for it in items:
        k = short_hash(it["category"] + it["item"])
        if k in seen_items:
            continue
        seen_items.add(k)
        findings.append({
            "key": k,
            "page": None,
            "text": f"(whole document) {it['item']}",
            "phrase": "",
            "status": "VIOLATION" if it["category"] == "missing_or_misleading_disclosure" else "NEEDS_HUMAN_REVIEW",
            "category": it["category"],
            "finding_type": "document_requirement",
            "severity": CATEGORIES[it["category"]],
            "reference": POLICY_STATE["refs"].get(it["policy_chunk_id"], "not specified"),
            "why": it["why"],
            "suggested_fix": it["suggested_fix"],
        })
    return findings

def check_document(pdf_path, user_name="staff", force_recheck=False):
    """STAFF: load the CHECK PDF and compare it with the stored policy."""
    if not os.path.isfile(pdf_path):
        raise FileNotFoundError(f"File not found: {pdf_path}")
    ensure_policy_loaded()

    units = build_units(pdf_path)
    if not units:
        raise ValueError("No text found in this PDF (scanned PDF? it needs OCR first).")

    version = POLICY_STATE["version"]
    cache_key = lambda u: f"{version}|{u['hash']}"

    pending, seen = [], set()
    for u in units:
        if (force_recheck or cache_key(u) not in VERDICT_CACHE) and u["hash"] not in seen:
            seen.add(u["hash"])
            pending.append(u)
    reused = len({u["hash"] for u in units}) - len(pending)

    for i in range(0, len(pending), UNITS_PER_CALL):
        batch = pending[i:i + UNITS_PER_CALL]
        results = judge_batch(batch)
        for u in batch:
            if u["id"] in results:
                VERDICT_CACHE[cache_key(u)] = results[u["id"]]
        save_cache()
        if SLEEP_BETWEEN_CALLS:
            time.sleep(SLEEP_BETWEEN_CALLS)

    verdicts = {u["hash"]: VERDICT_CACHE.get(cache_key(u)) for u in units}
    not_checked = sum(1 for v in verdicts.values() if v is None)

    findings, seen_keys = [], set()
    for u in units:
        v = verdicts[u["hash"]]
        if not v or v["scope"] == "internal_note" or v["status"] == "COMPLIANT":
            continue
        key = short_hash(u["hash"] + v["category"])
        if key in seen_keys:
            continue
        seen_keys.add(key)
        findings.append({
            "key": key,
            "page": u["page"],
            "text": u["text"],
            "phrase": v["phrase"],
            "status": v["status"],
            "category": v["category"],
            "finding_type": "statement",
            "severity": CATEGORIES[v["category"]],
            "reference": POLICY_STATE["refs"].get(v["policy_chunk_id"], "not specified"),
            "why": v["why"],
            "suggested_fix": v["suggested_fix"],
        })

    doc_findings = document_level_findings(units, verdicts)
    doc_check_failed = doc_findings is None
    findings.extend(doc_findings or [])
    
    # Calculate finding counts
    violation_count = sum(
        1 for f in findings
    if f["status"] == "VIOLATION"
)

    unverified_count = sum(
    1 for f in findings
    if f["status"] == "UNVERIFIED"
)

    human_review_count = sum(
    1 for f in findings
    if f["status"] == "NEEDS_HUMAN_REVIEW"
)

# Determine overall review status
    if doc_check_failed or not_checked > 0:
        overall_status = "REVIEW_INCOMPLETE"

    elif violation_count > 0:
        overall_status = "NON_COMPLIANT"

    elif unverified_count > 0 or human_review_count > 0:
        overall_status = "NEEDS_REVIEW"

    else:
        overall_status = "COMPLIANT"

    summary = {
    "overall_status": overall_status,
    "total_statements": len(units),
    "total_findings": len(findings),
    "violations": violation_count,
    "unverified": unverified_count,
    "needs_human_review": human_review_count,
    "not_checked": not_checked,
}
    

    return {
        "user": user_name,
        "file": os.path.basename(pdf_path),
        "policy": POLICY_STATE["name"],
        "policy_version": version,
        "pages": max(u["page"] for u in units) + 1,
        "statements": len(units),
        "reused": reused,
        "newly_judged": len(pending),
        "not_checked": not_checked,
        "doc_check_failed": doc_check_failed,
        "summary": summary, 
        "findings": findings,
    }

SEVERITY_COLORS = {"high": (1.0, 0.35, 0.35), "medium": (1.0, 0.65, 0.2), "low": (1.0, 0.95, 0.3)}


def _merge_words_by_line(words):
    lines = {}
    for w in words:
        lines.setdefault((w[5], w[6]), []).append(w)
    return [
        pymupdf.Rect(min(w[0] for w in g), min(w[1] for w in g), max(w[2] for w in g), max(w[3] for w in g))
        for g in lines.values()
    ]


def find_rects(page, text):
    tokens = normalize(text).split()
    if not tokens:
        return []
    rects = page.search_for(" ".join(tokens))
    if rects:
        return rects
    words = page.get_text("words")
    n = len(tokens)
    for fold in (False, True):
        want = [t.lower() for t in tokens] if fold else tokens
        have = [(w[4].lower() if fold else w[4]) for w in words]
        for i in range(len(have) - n + 1):
            if have[i:i + n] == want:
                return _merge_words_by_line(words[i:i + n])
    return []


def highlight_pdf(pdf_path, findings, out_path):
    doc = pymupdf.open(pdf_path)
    for f in findings:
        f["highlighted"] = ""
        if f["page"] is None:
            continue
        page = doc[f["page"]]
        rects = find_rects(page, f["text"])           # highlight the whole flagged statement
        f["highlighted"] = bool(rects)
        if not rects:
            continue
        annot = page.add_highlight_annot(quads=rects)
        annot.set_colors(stroke=SEVERITY_COLORS[f["severity"]])
        annot.set_info(
            title="Policy check",
            content=(f"[{f['severity'].upper()}] {f['status']} - {f['category']}\n"
                     f"Rule: {f['reference']}\nWhy: {f['why']}\nFix: {f['suggested_fix']}"),
        )
        annot.update()
    doc.save(out_path, garbage=4, deflate=True)
    doc.close()
    return out_path


def report_to_dataframe(report):
    rows = []
    for n, f in enumerate(report["findings"], start=1):
        rows.append({
            "No.": n,
            "Page": "document" if f["page"] is None else f["page"] + 1,
            "Status": f["status"],
            "Severity": f["severity"],
            "Category": f["category"],
            "Flagged content": f["text"],
            "Policy reference": f["reference"],
            "Why flagged": f["why"],
            "Suggested fix": f["suggested_fix"],
            "Next step": NEXT_STEP[f["severity"]],
            "Highlighted": f.get("highlighted", ""),
        })
    return pd.DataFrame(rows)


def render_report_md(report):
    lines = [f"# Compliance report: {report['file']}", "",
             f"Policy: `{report['policy']}` (version {report['policy_version']})  ",
             f"Statements reviewed: {report['statements']}  ", f"Findings: {len(report['findings'])}", ""]
    for n, f in enumerate(report["findings"], start=1):
        page = "whole document" if f["page"] is None else f"page {f['page'] + 1}"
        lines += [f"### {n}. [{f['severity'].upper()}] {f['status']} - {f['category']} ({page})",
                  f"- **Flagged:** {f['text']}", f"- **Policy:** {f['reference']}",
                  f"- **Why:** {f['why']}", f"- **Fix:** {f['suggested_fix']}",
                  f"- **Next step:** {NEXT_STEP[f['severity']]}", ""]
    return "\n".join(lines)



def index_policy_pdf(pdf_path: str, policy_name: str | None = None):
    """Index/replace the single active policy in the configured Qdrant collection."""
    return admin_upload_policy(pdf_path, replace=True, policy_name=policy_name)


def review_submission_pdf(pdf_path: str, user_name: str = "staff"):
    """Run the notebook's statement-level and document-level checks and create artifacts."""
    report = check_document(pdf_path, user_name=user_name)
    stem = os.path.splitext(os.path.basename(pdf_path))[0]
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    reviewed_pdf = None
    if report["findings"]:
        reviewed_pdf = os.path.join(OUTPUT_DIR, f"{stem}_REVIEWED_{stamp}.pdf")
        highlight_pdf(pdf_path, report["findings"], reviewed_pdf)

    report_json = os.path.join(OUTPUT_DIR, f"{stem}_{stamp}.json")
    report_md = os.path.join(OUTPUT_DIR, f"{stem}_{stamp}.md")
    with open(report_json, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    with open(report_md, "w", encoding="utf-8") as f:
        f.write(render_report_md(report))

    report["artifacts"] = {
        "reviewed_pdf": reviewed_pdf,
        "json": report_json,
        "markdown": report_md,
    }
    return report
