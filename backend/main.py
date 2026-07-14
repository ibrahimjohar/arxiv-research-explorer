import os
from typing import Optional, List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client
from sentence_transformers import SentenceTransformer, CrossEncoder

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

print("Loading models (happens once, at startup)...")
embedder = SentenceTransformer("all-MiniLM-L6-v2")
reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

CANDIDATE_POOL_SIZE = 30    #broad dense-search net
FINAL_RESULT_COUNT = 5      #after reranking

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],    #tighten this to the real frontend domain once deployed
    allow_methods=["*"],
    allow_headers=["*"],
)


class SearchRequest(BaseModel):
    query: str
    category: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None


class SearchResult(BaseModel):
    title: str
    authors: List[str]
    published_date: str
    section: Optional[str]
    matching_snippet: str
    arxiv_url: str


@app.post("/search", response_model=List[SearchResult])
def search(request: SearchRequest):
    query_embedding = embedder.encode(request.query).tolist()

    candidates = supabase.rpc(
        "match_chunks",
        {
            "query_embedding": query_embedding,
            "match_count": CANDIDATE_POOL_SIZE,
            "filter_category": request.category,
            "filter_date_from": request.date_from,
            "filter_date_to": request.date_to,
        },
    ).execute().data

    if not candidates:
        return []

    #rerank: score each candidate chunk against the actual query text together, not independently, this is the precision step dense search alone can't do
    pairs = [[request.query, c["content"]] for c in candidates]
    scores = reranker.predict(pairs)
    for candidate, score in zip(candidates, scores):
        candidate["rerank_score"] = float(score)
    candidates.sort(key=lambda c: c["rerank_score"], reverse=True)

    #roll up to one result per paper, its single best-scoring chunk
    seen_papers = set()
    results = []
    for c in candidates:
        if c["paper_id"] in seen_papers:
            continue
        seen_papers.add(c["paper_id"])
        results.append(SearchResult(
            title=c["title"],
            authors=c["authors"],
            published_date=str(c["published_date"]),
            section=c["section"],
            matching_snippet=c["content"][:300],
            arxiv_url=f"https://arxiv.org/abs/{c['arxiv_id']}",
        ))
        if len(results) >= FINAL_RESULT_COUNT:
            break

    return results