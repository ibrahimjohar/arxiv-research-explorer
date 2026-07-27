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
# Figures are searched via their caption text, embedded with this same model —
# no separate CLIP model. CLIP produced noisy cross-paper matches for
# scientific plots/diagrams specifically; genuine captions embedded as plain
# text, in the same space as chunk search, turned out to be the more
# reliable signal — and it also means one fewer model competing for memory.

CANDIDATE_POOL_SIZE = 30    # broad dense-search net
FINAL_RESULT_COUNT = 5      # after reranking

FIGURE_CANDIDATE_COUNT = 6   # how many figure candidates to pull per search
# Same embedding space as chunk search now (both all-MiniLM-L6-v2 text
# embeddings), so this threshold is on a genuinely comparable scale to real
# text-to-text similarity — still a starting value pending real tuning,
# but no longer mismatched the way the CLIP cross-modal score was.
FIGURE_SIMILARITY_THRESHOLD = 0.3

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],    # tighten this to the real frontend domain once deployed
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


class FigureResult(BaseModel):
    caption: Optional[str]
    storage_path: str
    arxiv_url: str
    title: str


class SearchResponse(BaseModel):
    results: List[SearchResult]
    figures: List[FigureResult]


@app.post("/search", response_model=SearchResponse)
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

    results = []
    if candidates:
        # rerank: score each candidate chunk against the actual query text
        # together, not independently — this is the precision step dense
        # search alone can't do
        pairs = [[request.query, c["content"]] for c in candidates]
        scores = reranker.predict(pairs)
        for candidate, score in zip(candidates, scores):
            candidate["rerank_score"] = float(score)
        candidates.sort(key=lambda c: c["rerank_score"], reverse=True)

        # roll up to one result per paper, its single best-scoring chunk
        seen_papers = set()
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

    # Figures now live in the same embedding space as chunks (both
    # all-MiniLM-L6-v2), so the query embedding computed above is reused
    # directly — no second model, no second encode call.
    figure_candidates = supabase.rpc(
        "match_figures",
        {
            "query_embedding": query_embedding,
            "match_count": FIGURE_CANDIDATE_COUNT,
            "filter_category": request.category,
        },
    ).execute().data or []
    print("Figure candidates:", [(round(f["similarity"], 3), f.get("caption", "")[:80]) for f in figure_candidates], flush=True)  # temporary — remove after tuning the threshold

    figures = [
        FigureResult(
            caption=f.get("caption"),
            storage_path=f["storage_path"],
            arxiv_url=f"https://arxiv.org/abs/{f['arxiv_id']}",
            title=f["title"],
        )
        for f in figure_candidates
        if f["similarity"] >= FIGURE_SIMILARITY_THRESHOLD
    ]

    return SearchResponse(results=results, figures=figures)


from groq import Groq

groq_client = Groq(api_key=os.environ["GROQ_API_KEY"])
GROQ_MODEL = "openai/gpt-oss-120b"


class AskRequest(BaseModel):
    question: str
    category: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None


class Source(BaseModel):
    title: str
    arxiv_id: str
    section: Optional[str]


class AskResponse(BaseModel):
    answer: str
    sources: List[Source]


@app.post("/ask", response_model=AskResponse)
def ask(request: AskRequest):
    query_embedding = embedder.encode(request.question).tolist()

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
        return AskResponse(
            answer="I couldn't find anything in the indexed papers relevant to that question.",
            sources=[],
        )

    pairs = [[request.question, c["content"]] for c in candidates]
    scores = reranker.predict(pairs)
    for candidate, score in zip(candidates, scores):
        candidate["rerank_score"] = float(score)
    candidates.sort(key=lambda c: c["rerank_score"], reverse=True)

    top_chunks = candidates[:FINAL_RESULT_COUNT]
    # most relevant last, right next to the question — counters the
    # lost-in-the-middle effect where models attend better to context edges
    top_chunks.reverse()

    context_blocks = []
    for c in top_chunks:
        context_blocks.append(
            f"[Source: \"{c['title']}\" (arXiv:{c['arxiv_id']}), section: {c['section'] or 'unknown'}]\n{c['content']}"
        )
    context_text = "\n\n".join(context_blocks)

    prompt = f"""You are a research assistant for an arXiv paper search tool. Most questions will be about the paper excerpts below — for those, answer using ONLY the excerpts, paraphrasing rather than quoting long passages, and say plainly if the excerpts don't cover the question.

            If the question is just a greeting, thanks, or casual small talk rather than an actual research question (e.g. "hello", "thanks", "how are you"), respond naturally and briefly instead — don't force an answer out of the excerpts or apologize that they don't cover it.

            Paper excerpts:
            {context_text}

            Question: {request.question}

            Respond with ONLY a JSON object in this exact shape, no other text:
            {{"answer": "your answer here", "used_arxiv_ids": ["id1", "id2"]}}
            The used_arxiv_ids list must only include arXiv IDs of papers you actually drew on. For casual small talk with no real research content, this list should be empty."""

    completion = groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )

    import json
    try:
        parsed = json.loads(completion.choices[0].message.content)
        answer_text = parsed["answer"]
        used_ids = set(parsed.get("used_arxiv_ids", []))
    except (json.JSONDecodeError, KeyError):
        # fall back gracefully rather than crash if the model doesn't
        # follow the format for some reason
        answer_text = completion.choices[0].message.content
        used_ids = {c["arxiv_id"] for c in top_chunks}

    seen = set()
    sources = []
    for c in top_chunks:
        if c["arxiv_id"] not in used_ids or c["arxiv_id"] in seen:
            continue
        seen.add(c["arxiv_id"])
        sources.append(Source(title=c["title"], arxiv_id=c["arxiv_id"], section=c["section"]))

    return AskResponse(answer=answer_text, sources=sources)