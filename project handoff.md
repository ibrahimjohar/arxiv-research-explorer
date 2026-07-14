# arXiv Research Explorer — Handoff Document

*Status as of this session. Captures what's actually built, what was decided and why, gotchas hit along the way, and what's left. Read this to get back up to speed without re-reading the whole build history.*

## What this project is
A hybrid-search research assistant over a continuously growing corpus of arXiv papers (currently tracking `cs.AI`). Full paper text is scraped, cleaned, chunked, and embedded — not just abstracts. Users will be able to hybrid-search (semantic query + category/date filters) and ask natural-language questions answered from actual retrieved paper content, with reliable citations.

Repo: `github.com/ibrahimjohar/arxiv-research-explorer`

## Current status

| Piece | Status |
|---|---|
| Repo, venv, `.gitignore`, README | ✅ Done |
| Supabase project + schema (`papers`, `chunks`, pgvector) | ✅ Done |
| Ingestion script (`ingestion/ingest.py`) — fetch, parse, chunk, embed | ✅ Done, tested against real data (863+ chunks across 24+ papers) |
| Scheduled ingestion via GitHub Actions | ✅ Done, running daily at 6 AM UTC, manually verified working |
| `match_chunks` SQL function (hybrid search: pgvector + filters) | ✅ Done |
| FastAPI `/search` endpoint (retrieval + reranking) | ✅ Done, tested, returns precise results |
| FastAPI `/ask` endpoint (RAG Q&A + structured citations) | ✅ Done, tested, citations verified accurate |
| Frontend (Next.js + React + Framer Motion) | ⬜ Not started — next step |
| Deployment (Render, Vercel) | ⬜ Not started |

## Architecture, as actually built

| Layer | Technology | Notes |
|---|---|---|
| Database | Supabase (Postgres + pgvector) | `papers` = metadata, `chunks` = full-text pieces + embeddings |
| Ingestion | Python (`ingestion/ingest.py`), scheduled via GitHub Actions | Daily cron, `workflow_dispatch` for manual runs |
| Embeddings | `all-MiniLM-L6-v2` | Same model used in ingestion and backend, must stay in sync |
| Reranking | `cross-encoder/ms-marco-MiniLM-L-6-v2` | Reranks a top-30 dense-retrieved candidate pool down to top-5 |
| LLM | Groq API, **`openai/gpt-oss-120b`** | Not `llama-3.3-70b-versatile` — that model was deprecated by Groq (announced June 17, 2026) partway through this build; recommended replacement used instead |
| Backend | FastAPI (`backend/main.py`) | `/search` and `/ask`, both hybrid-search + rerank |
| Frontend | Next.js, React, Framer Motion | Not yet built |

## Key decisions and why

- **arXiv category: `cs.AI`, kept broad on purpose** — this being a general-purpose tool, not tailored to one person's research niche, was an explicit choice
- **Cross-listed papers kept as-is** — `cat:cs.AI` search matches papers whose true primary category is something else (e.g. cs.LG) but are cross-listed under cs.AI; we store the real primary category rather than forcing everything to say "cs.AI." Decided to keep this richer variety rather than restrict to strict-primary-cs.AI only.
- **Full paper text indexed, not just abstracts** — a deliberate upgrade partway through planning, specifically to make the tool do something a "chat with one PDF" tool structurally can't
- **Supabase (Postgres + pgvector) over FAISS + separate DB** — one system handles both structured metadata and vector search, so hybrid queries are a single SQL call, not an application-level merge of two systems
- **GitHub Actions over Render Cron** — Render's cron jobs aren't free; GitHub Actions scheduled workflows are, with unlimited minutes on a public repo
- **Reranking included in v1, not deferred** — originally scoped as a "v2 upgrade" for simplicity, but reconsidered: the embedding model is small and not highly precise on its own, and a lightweight cross-encoder rerank is cheap enough that skipping it wasn't a strong trade-off
- **Structured JSON output from the LLM for citations** — an early version asked the model to name its sources in free text at the end of its answer, and testing showed a real mismatch (reported sources didn't match what the answer actually drew on). Fixed by having the model return `{"answer": ..., "used_arxiv_ids": [...]}` as constrained JSON, so citations are built from what the model actually says it used, not from whatever happened to be in its context window.

## Real problems hit and how they were fixed
*(Worth knowing so the same mistakes aren't repeated, and so future debugging has context.)*

- **`permission denied for table papers`** — unchecking "Automatically expose new tables" during Supabase setup (a good security choice) also skipped granting `service_role` basic table privileges. Fixed with explicit `grant select, insert, update, delete` statements. RLS bypass and base table grants are separate things — both are needed.
- **`\u0000 cannot be converted to text`** — some PDFs contain stray null bytes in extracted text (corrupted fonts/encoding); Postgres rejects them outright. Fixed by stripping `\x00` in `clean_text`.
- **Silent permanent failure risk** — originally, one paper's chunk-insert failure would crash the whole ingestion run, and because its metadata row was already saved, later runs would treat it as "already exists" and never retry its full text. Fixed with a `get_papers_without_chunks` check that finds and retries any paper missing chunks, plus try/except around per-paper processing so one bad PDF doesn't take down the whole run.
- **Workflow file in the wrong folder** — first attempt landed at `workflows/ingest.yml` instead of `.github/workflows/ingest.yml`, so GitHub Actions never recognized it as a workflow at all despite committing/pushing fine. Moved with `git mv`.
- **Node.js 20 deprecation warnings** — `actions/checkout@v4` and `actions/setup-python@v5` both targeted a Node runtime GitHub is phasing out. Bumped to `actions/checkout@v6` and `actions/setup-python@v6.2.0` (the literal `v6` floating tag doesn't exist for setup-python — needed the specific version).
- **Groq model deprecation** — `llama-3.3-70b-versatile` (the model originally chosen) was announced deprecated mid-build. Switched to Groq's own recommended replacement, `openai/gpt-oss-120b`, before it ever shipped with the dead model.
- **Citation mismatch** — see "structured JSON output" above.

## Environment variables / secrets in use

**Local `.env`** (repo root, gitignored):
```
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
GROQ_API_KEY=...
```

**GitHub Actions repo secrets** (Settings → Secrets and variables → Actions):
```
SUPABASE_URL
SUPABASE_SERVICE_KEY
```

## Repo structure so far
```
arxiv-research-explorer/
├── .github/workflows/ingest.yml
├── ingestion/ingest.py
├── backend/
│   ├── main.py
│   └── requirements.txt
├── requirements.txt          (ingestion deps)
├── .gitignore
├── .env                      (gitignored, not in repo)
└── README.md
```

## What's next
Step 7 onward from the original plan: build the Next.js frontend, starting with the search screen, then the Q&A screen with Framer Motion, then connect to the local backend, run the evaluation pass, and deploy (Render for backend, Vercel for frontend).