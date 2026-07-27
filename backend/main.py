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
#figures are searched via title+caption text, embedded with this same
#model - no separate CLIP model.

CANDIDATE_POOL_SIZE = 30    #broad dense-search net
FINAL_RESULT_COUNT = 5      #after reranking

FIGURE_CANDIDATE_COUNT = 6
FIGURE_SIMILARITY_THRESHOLD = 0.3  #confirmed against real query/figure pairs

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
        pairs = [[request.query, c["content"]] for c in candidates]
        scores = reranker.predict(pairs)
        for candidate, score in zip(candidates, scores):
            candidate["rerank_score"] = float(score)
        candidates.sort(key=lambda c: c["rerank_score"], reverse=True)

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

    figure_candidates = supabase.rpc(
        "match_figures",
        {
            "query_embedding": query_embedding,
            "match_count": FIGURE_CANDIDATE_COUNT,
            "filter_category": request.category,
        },
    ).execute().data or []

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
#Groq's own docs mark this as a preview model - intended for evaluation, not production. but it's currently the only vision-capable option available.
VISION_MODEL = "qwen/qwen3.6-27b"


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
    figure: Optional[FigureResult] = None


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
    top_chunks.reverse()

    context_blocks = []
    for c in top_chunks:
        context_blocks.append(
            f"[Source: \"{c['title']}\" (arXiv:{c['arxiv_id']}), section: {c['section'] or 'unknown'}]\n{c['content']}"
        )
    context_text = "\n\n".join(context_blocks)

    #same embedding, same threshold as /search's figure retrieval. Only the single best candidate is considered, keeps the "should this route to
    #the vision model" decision simple and unambiguous, rather than trying to juggle multiple images in one answer.
    figure_candidates = supabase.rpc(
        "match_figures",
        {
            "query_embedding": query_embedding,
            "match_count": FIGURE_CANDIDATE_COUNT,
            "filter_category": request.category,
        },
    ).execute().data or []

    best_figure = None
    if figure_candidates and figure_candidates[0]["similarity"] >= FIGURE_SIMILARITY_THRESHOLD:
        best_figure = figure_candidates[0]

    figure_context = ""
    if best_figure:
        figure_context = (
            f"\n\nAn image is also attached, from \"{best_figure['title']}\" "
            f"(arXiv:{best_figure['arxiv_id']}). It is described as: "
            f"{best_figure['caption']}. Use it to inform your answer if relevant "
            f"to the question."
        )

    prompt = f"""You are a research assistant for an arXiv paper search tool. Most questions will be about the paper excerpts below — for those, answer using ONLY the excerpts, paraphrasing rather than quoting long passages, and say plainly if the excerpts don't cover the question.

            If the question is just a greeting, thanks, or casual small talk rather than an actual research question (e.g. "hello", "thanks", "how are you"), respond naturally and briefly instead — don't force an answer out of the excerpts or apologize that they don't cover it.

            Paper excerpts:
            {context_text}
            {figure_context}

            Question: {request.question}

            Respond with ONLY a JSON object in this exact shape, no other text:
            {{"answer": "your answer here", "used_arxiv_ids": ["id1", "id2"]}}
            The used_arxiv_ids list must only include arXiv IDs of papers you actually drew on. For casual small talk with no real research content, this list should be empty."""

    if best_figure:
        messages = [{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": best_figure["storage_path"]}},
            ],
        }]
        model_to_use = VISION_MODEL
    else:
        messages = [{"role": "user", "content": prompt}]
        model_to_use = GROQ_MODEL

    completion_kwargs = {
        "model": model_to_use,
        "messages": messages,
        "response_format": {"type": "json_object"},
    }
    if model_to_use == VISION_MODEL:
        #Qwen models default to a "thinking" reasoning mode before the final answer - combined with strict JSON mode, this preview model was
        #returning a completely empty completion, apparently spending its output budget on reasoning with nothing left for the visible answer.
        #Disabling reasoning fixes this.
        completion_kwargs["reasoning_effort"] = "none"

    try:
        completion = groq_client.chat.completions.create(**completion_kwargs)
    except Exception as e:
        if model_to_use == VISION_MODEL:
            #Groq's own docs mark this model as preview/eval-only, not production-stable - if it fails outright, fall back to the
            #proven text-only model rather than surfacing a 500 to the user.
            print(f"Vision model call failed, falling back to text-only: {e}", flush=True)
            best_figure = None      #so the returned_figure logic below correctly omits it
            completion = groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
            )
        else:
            raise

    import json
    try:
        parsed = json.loads(completion.choices[0].message.content)
        answer_text = parsed["answer"]
        used_ids = set(parsed.get("used_arxiv_ids", []))
    except (json.JSONDecodeError, KeyError):
        answer_text = completion.choices[0].message.content
        used_ids = {c["arxiv_id"] for c in top_chunks}

    seen = set()
    sources = []
    for c in top_chunks:
        if c["arxiv_id"] not in used_ids or c["arxiv_id"] in seen:
            continue
        seen.add(c["arxiv_id"])
        sources.append(Source(title=c["title"], arxiv_id=c["arxiv_id"], section=c["section"]))

    #the figure is only returned if the model's own used_arxiv_ids actually includes its paper - same discipline as text citations.
    #A figure that was merely retrieved but not actually drawn on should never appear as "used."
    returned_figure = None
    if best_figure and best_figure["arxiv_id"] in used_ids:
        returned_figure = FigureResult(
            caption=best_figure.get("caption"),
            storage_path=best_figure["storage_path"],
            arxiv_url=f"https://arxiv.org/abs/{best_figure['arxiv_id']}",
            title=best_figure["title"],
        )

    return AskResponse(answer=answer_text, sources=sources, figure=returned_figure)