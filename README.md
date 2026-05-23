# RAG Career Assistant

- Upload and ingest resume/JD files
- Index chunks to vector DB
- Chat with grounded citations
- Run deterministic match analysis and skill-gap scoring
- View ops dashboard metrics

## Tech Stack

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- App data: MongoDB
- Embeddings/LLM: Qwen (DashScope)
- Vector DB: Qdrant (primary), Mongo vector fallback

## Product Flow

Main tabs:

- Upload
- RAG Chat
- Match Analysis

Advanced tools (optional):

- Vector indexing controls
- Retrieval debugger
- Dashboard

Power BI integration endpoints exist in backend, but BI is hidden in the main UI.

## Local Setup

### 1) Prerequisites

- Node.js 20+
- npm
- MongoDB local instance
- Qdrant local instance (recommended)

Run Qdrant with Docker:

```bash
docker run -p 6333:6333 qdrant/qdrant:latest
```

Qdrant dashboard: `http://localhost:6333/dashboard`

### 2) Environment

Create `backend/.env`:

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017/rag-career-assistant
USE_IN_MEMORY_MONGO=false

MAX_FILE_SIZE_MB=5
DEFAULT_CHUNK_SIZE=800
DEFAULT_CHUNK_OVERLAP=120

EMBEDDING_PROVIDER=qwen
DASHSCOPE_API_KEY=your_dashscope_api_key
QWEN_EMBEDDING_MODEL=text-embedding-v3
LOCAL_EMBEDDING_DIM=384

VECTOR_DB_MODE=qdrant
QDRANT_URL=http://127.0.0.1:6333
QDRANT_API_KEY=
QDRANT_COLLECTION=career_chunks
EMBEDDING_BATCH_SIZE=16

QWEN_CHAT_MODEL=qwen-plus
CHAT_MAX_CONTEXT_CHUNKS=6
CHAT_MIN_RELEVANCE_SCORE=0.25
CHAT_FALLBACK_TO_EXTRACTIVE=false

M5_ANALYSIS_DEFAULT_TOPK=8

# Optional backend BI endpoints (UI currently hides BI panel)
POWERBI_MODE=public
POWERBI_EMBED_URL=
POWERBI_REPORT_ID=
POWERBI_TENANT_ID=
POWERBI_CLIENT_ID=
POWERBI_CLIENT_SECRET=
POWERBI_WORKSPACE_ID=
```

### 3) Install and run

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

Run backend:

```bash
npm run dev --prefix backend
```

Run frontend:

```bash
npm run dev --prefix frontend
```

Frontend: `http://localhost:5173`

## Current Features

### Upload + Ingestion

- PDF/TXT/DOCX upload
- Text extraction + chunking
- Metadata/chunks persisted in MongoDB
- Indexing mode toggle:
  - Manual
  - Auto index after upload
- Destructive action:
  - Delete all uploaded files/chunks/vector mappings

### Vector Indexing + Retrieval

- Index one file or all pending files
- Multi-provider embeddings (Qwen/local)
- Qdrant or Mongo vector retrieval
- Similarity scores + source metadata
- Destructive action:
  - Delete all vectors and reset indexing status

### RAG Chat + Citations

- Session-based chat
- Grounded citations (filename/chunk index/chunk id/score)
- Insufficient-evidence guardrail response
- Multi-file filter support (select multiple indexed files)

### Match Analysis

Deterministic scoring (0-100), weighted rubric:

- Skill Coverage (50%)
- Experience Alignment (20%)
- Tool/Tech Depth (20%)
- Domain Similarity (10%)

Outputs:

- Overall score + confidence
- Matched / missing / weak skills
- Evidence-backed references
- Recommendations

### Dashboard

- KPI summary
- Match trend
- Top missing skills
- Recent activity

## API Quick Reference

### Health

- `GET /api/health`

### Ingestion

- `POST /api/ingest`
- `GET /api/ingest/files`
- `DELETE /api/ingest/files`

### Vectors

- `POST /api/vector/index/file/:fileId`
- `POST /api/vector/index/all`
- `DELETE /api/vector/index/all`
- `GET /api/vector/index/status`
- `POST /api/vector/retrieve`

Retrieval request supports both:

- `fileId` (single)
- `fileIds` (multi)

### Chat

- `POST /api/chat/sessions`
- `GET /api/chat/sessions`
- `GET /api/chat/sessions/:sessionId/messages`
- `POST /api/chat/sessions/:sessionId/messages`

Send message payload:

```json
{
  "question": "How does this candidate match backend intern role?",
  "topK": 6,
  "fileIds": ["resume_file_id", "jd_file_id"]
}
```

### Match Analysis

- `POST /api/analysis/match`
- `GET /api/analysis`

### Dashboard

- `GET /api/dashboard/summary?days=30&fileType=resume`
- `GET /api/dashboard/match-trend?days=30`
- `GET /api/dashboard/skill-gaps?limit=10`

### BI Export (optional backend endpoints)

- `GET /api/bi/dataset`
- `GET /api/bi/export/json`
- `GET /api/bi/export/csv`
- `GET /api/bi/powerbi/embed-config`

## Build and Tests

Build all:

```bash
npm run build
```

Backend tests:

```bash
npm run test --prefix backend
```

Note: in some sandboxed environments, `tsx --test` may fail due IPC permission (`EPERM`), while build still passes.

## Ship Checklist

- [ ] Backend and frontend both run locally
- [ ] Upload + auto/manual indexing both work
- [ ] Chat returns grounded citations
- [ ] Multi-file chat filter works
- [ ] Match analysis returns deterministic score + skills
- [ ] Dashboard reflects recent activity
- [ ] README and `.env` are up to date
- [ ] No lint/type errors on changed files

## Known Limitations

- No auth/authorization yet (demo-focused app)
- Delete-all endpoints are intentionally powerful for local demos
- Skill extraction is deterministic keyword-based, not ontology-complete
- Charts are lightweight (no advanced interactive analytics)
# RAG Career Assistant (M1-M6)

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- App data: MongoDB
- Embeddings: Qwen (DashScope API)
- Vector DB: Qdrant (primary), Mongo fallback mode for local unblock

## Current Milestone Status

- M1: Project scaffold and local run
- M2: File ingestion (PDF/TXT/DOCX), parsing, chunking, Mongo storage
- M3: Embedding, vector indexing, retrieval with scores + source metadata
- M4: Chat orchestration with grounded citations + chat session persistence
- M5: Deterministic JD match scoring + skill gap analysis with evidence citations
- M6: Dashboard analytics + product polish

## Local Setup

## 1) Start dependencies

- MongoDB (local)
- Qdrant (Docker):

```bash
docker run -p 6333:6333 qdrant/qdrant:latest
```

Qdrant dashboard: `http://localhost:6333/dashboard`

## 2) Backend env

Create `backend/.env`:

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017/rag-career-assistant
USE_IN_MEMORY_MONGO=false
MAX_FILE_SIZE_MB=5
DEFAULT_CHUNK_SIZE=800
DEFAULT_CHUNK_OVERLAP=120

EMBEDDING_PROVIDER=qwen
DASHSCOPE_API_KEY=your_dashscope_api_key
QWEN_EMBEDDING_MODEL=text-embedding-v3
LOCAL_EMBEDDING_DIM=384

QDRANT_URL=http://127.0.0.1:6333
QDRANT_API_KEY=
QDRANT_COLLECTION=career_chunks
VECTOR_DB_MODE=qdrant
EMBEDDING_BATCH_SIZE=16
QWEN_CHAT_MODEL=qwen-plus
CHAT_MAX_CONTEXT_CHUNKS=6
CHAT_MIN_RELEVANCE_SCORE=0.25
CHAT_FALLBACK_TO_EXTRACTIVE=false
M5_ANALYSIS_DEFAULT_TOPK=8

POWERBI_MODE=public
POWERBI_EMBED_URL=https://app.powerbi.com/view?r=...
POWERBI_REPORT_ID=
POWERBI_TENANT_ID=
POWERBI_CLIENT_ID=
POWERBI_CLIENT_SECRET=
POWERBI_WORKSPACE_ID=
```

## 3) Run app

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

Frontend URL: `http://localhost:5173`

## M3 Verified Flow (What to Demo)

1. Upload resume/JD in M2 section (gets `fileId`).
2. Click `Index This File` in M3 indexing section.
3. Enter retrieval query and run retrieval.
4. Confirm returned:
   - similarity scores
   - source filename
   - chunk index
   - chunk text preview

Expected success signal:
- UI shows `Retrieved N chunks.`
- Backend logs no Qdrant upsert errors.

## M3 APIs

- `POST /api/vector/index/file/:fileId`
- `POST /api/vector/index/all`
- `GET /api/vector/index/status`
- `POST /api/vector/retrieve`

Example retrieval:

```bash
curl -X POST "http://localhost:4000/api/vector/retrieve" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Node.js backend and MongoDB experience",
    "topK": 3,
    "fileId": "your_file_id"
  }'
```

## Regression Smoke Test


1. `POST /api/health` works.
2. Upload one sample file succeeds.
3. Index that file succeeds.
4. Retrieval returns at least one chunk with score and source metadata.


## M4 Chat Usage

### What M4 Adds

- Chat sessions in MongoDB (`create/list/messages`)
- `send message` endpoint that runs retrieval + prompt composition + Qwen answer generation
- Grounded citations in assistant responses:
  - source filename
  - chunk index
  - chunk id
  - similarity score
- Safety behavior for weak evidence: assistant returns an "insufficient evidence" style answer

### M4 Backend Env Additions

```env
QWEN_CHAT_MODEL=qwen-plus
CHAT_MAX_CONTEXT_CHUNKS=6
CHAT_MIN_RELEVANCE_SCORE=0.25
```

### M4 APIs

- `POST /api/chat/sessions`
- `GET /api/chat/sessions`
- `GET /api/chat/sessions/:sessionId/messages`
- `POST /api/chat/sessions/:sessionId/messages`

Create session:

```bash
curl -X POST "http://localhost:4000/api/chat/sessions" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Send message (RAG answer with citations):

```bash
curl -X POST "http://localhost:4000/api/chat/sessions/<session_id>/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How does this candidate match a Node.js backend role?",
    "topK": 6,
    "fileId": "optional_file_id_filter"
  }'
```

### M4 Demo Steps (UI)

1. Upload and index at least one file in M2/M3 sections.
2. Open **M4 Chat (RAG + Citations)** section.
3. Click **New** session.
4. Ask a question and optionally set `fileId` + `topK`.
5. Verify assistant response contains **Citations** list with deterministic chunk references.

## M5 Match Analysis Usage

### What M5 Adds

- Deterministic and explainable score formula (0-100):
  - Skill Coverage (50%)
  - Experience Alignment (20%)
  - Tool/Tech Depth (20%)
  - Domain/Responsibility Similarity (10%)
- Skill categories:
  - matched skills
  - missing skills
  - weak skills
- Evidence citations with traceable references:
  - source file name
  - chunk index
  - chunk id
  - similarity score
- Persisted analysis records in MongoDB

### M5 API

- `POST /api/analysis/match`
- `GET /api/analysis?resumeFileId=...&jdFileId=...`

Run analysis:

```bash
curl -X POST "http://localhost:4000/api/analysis/match" \
  -H "Content-Type: application/json" \
  -d '{
    "resumeFileId": "resume_file_id",
    "jdFileId": "jd_file_id",
    "topK": 8
  }'
```

### M5 Demo Steps (UI)

1. Upload Resume + JD files in M2 section.
2. Index both files in M3 section.
3. Open **M5 JD Match Scoring + Skill Gap Analysis** section.
4. Fill `resumeFileId` + `jdFileId`, then run analysis.
5. Verify output includes score, breakdown, skills, recommendations, and evidence.

## M6 Dashboard Usage

### M6 APIs

- `GET /api/dashboard/summary?days=30&fileType=resume`
- `GET /api/dashboard/match-trend?days=30`
- `GET /api/dashboard/skill-gaps?limit=10`
- `GET /api/bi/dataset?days=30&fileType=resume&skillGapLimit=10`
- `GET /api/bi/export/json?days=30&fileType=resume&skillGapLimit=10`
- `GET /api/bi/export/csv?days=30&fileType=resume&skillGapLimit=10`
- `GET /api/bi/powerbi/embed-config`

Summary endpoint includes:

- total files + files by type
- indexing health counts
- total chat sessions/messages
- total analyses + average match score
- recent files/chats/analyses

### M6 Demo Steps (UI)

1. Create activity through M2-M5 sections (upload/index/chat/analyze).
2. Open **M6 Dashboard + Final Polish** section.
3. Switch time range (`7d/30d/90d`) and optional file type filter.
4. Verify KPI cards, trend bars, top missing skills, and recent activity update.

## Power BI Integration Setup

### 1) Public mode (fast demo, non-production)

Use publish-to-web URL:

```env
POWERBI_MODE=public
POWERBI_EMBED_URL=https://app.powerbi.com/view?r=your_publish_to_web_url
```

This mode is easy for demos, but data is publicly accessible to anyone with the link.

### 2) Secure mode (recommended for production)

Use service principal credentials and backend token generation:

```env
POWERBI_MODE=secure
POWERBI_EMBED_URL=https://app.powerbi.com/reportEmbed?reportId=...&groupId=...
POWERBI_REPORT_ID=your_report_id
POWERBI_TENANT_ID=your_tenant_id
POWERBI_CLIENT_ID=your_aad_app_client_id
POWERBI_CLIENT_SECRET=your_aad_app_client_secret
POWERBI_WORKSPACE_ID=your_powerbi_workspace_id
```

In secure mode, secrets stay on backend. Frontend only receives short-lived embed config/token.

## Known Limitations After M6

- Trend chart is a lightweight bar visualization (no advanced chart interactions).
- Keyword normalization for skill extraction is deterministic and may miss uncommon aliases.
- Scoring is explainable but still heuristic (not a calibrated hiring benchmark).
- No export/report generation yet.
# llm
# llm
