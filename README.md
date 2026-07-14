# arXiv Research Explorer

A hybrid-search research assistant for arXiv papers. It combines structured filtering (category, date) with semantic search over full paper text, then answers natural-language questions with citations back to the exact paper and section they came from.

## Why this exists

Uploading a single PDF to a chat interface and asking questions about it is something general-purpose AI assistants already do natively — it doesn't demonstrate anything a retrieval system does that a plain chat window can't. This project is built to actually require the parts of RAG that matter in practice:

- A corpus that grows on its own from a live source, not from whatever one file happens to be on hand
- Structured metadata (category, publication date) combined with semantic similarity in a single hybrid query — not similarity search alone
- Full paper text, not just abstracts, so answers can draw on methodology and results, not only the summary
- A reranking step that re-scores retrieved candidates for precision, rather than trusting raw similarity scores
- An unattended ingestion pipeline that scrapes, cleans, and indexes new papers on a schedule

## Features

- **Hybrid search** — natural language queries combined with category and date-range filters
- **Ask mode** — ask a question in plain language and get an answer grounded in retrieved paper content, with citations to the source paper and section
- **Continuously updated corpus** — new papers are ingested on a recurring schedule, not just at setup time
- **Section-aware indexing** — paper text is split by detected section (introduction, method, results, etc.) where possible, and reference lists are excluded from search

## Architecture

| Layer | Technology | Role |
|---|---|---|
| Frontend | Next.js, React, Framer Motion | Search UI and Q&A interface |
| Backend | FastAPI (Python) | Serves search and ask endpoints, runs reranking |
| Database | Supabase (Postgres + pgvector) | Stores paper metadata and embedded text chunks; powers hybrid search |
| Embeddings | `all-MiniLM-L6-v2` (sentence-transformers) | Turns text into vectors for similarity search |
| Reranking | `cross-encoder/ms-marco-MiniLM-L-6-v2` | Re-scores retrieved candidates for precision |
| LLM | Groq API (Llama 3.3 70B) | Generates grounded answers from retrieved context |
| Ingestion | Python script scheduled via GitHub Actions | Fetches, cleans, chunks, and embeds new papers |

**How a search works:** a query is embedded and matched against stored chunks using pgvector similarity combined with SQL filters on category and date, pulling a broad candidate set. That set is then reranked by a cross-encoder for precision before being returned or handed to the LLM.

**How ingestion works:** on a schedule, a script queries the arXiv API for new papers in the configured category, downloads and parses each PDF, strips the reference section, splits the remaining text into chunks by detected section, embeds those chunks, and stores everything in Supabase — skipping papers already indexed.

## Data source and compliance

Built on the [arXiv API](https://info.arxiv.org/help/api/index.html). Ingestion respects arXiv's rate limits (roughly one request every three seconds) and identifies itself with a descriptive User-Agent. Every search result links directly to the paper's original arXiv page.

Thank you to arXiv for use of its open access interoperability.