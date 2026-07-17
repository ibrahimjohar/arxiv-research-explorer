import os
import re
import time
from datetime import datetime

import requests
import feedparser
import fitz  # PyMuPDF
from dotenv import load_dotenv
from supabase import create_client
from sentence_transformers import SentenceTransformer

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

ARXIV_CATEGORY = "cs.AI"
PAPERS_PER_RUN = 30
USER_AGENT = "arxiv-research-explorer/0.1 (portfolio project; contact: your-email@example.com)"

CHUNK_WORDS = 400
CHUNK_OVERLAP = 50

SECTION_PATTERN = re.compile(
    r"^\s*(\d+\.?\d*\.?\s*|[IVXLC]+\.?\s*)?"
    r"(introduction|background|related work|methodology|method|approach|"
    r"experiments?( and results)?|evaluation|results?|discussion|"
    r"conclusions?|limitations|future work)\s*$",
    re.IGNORECASE,
)
REFERENCES_PATTERN = re.compile(r"^\s*(\d+\.?\s*)?(references|bibliography)\s*$", re.IGNORECASE)

print("Loading embedding model...", flush=True)
embedder = SentenceTransformer("all-MiniLM-L6-v2")


def request_with_retry(url, max_retries=3, **kwargs):
    """Retry with backoff on rate limits/transient server errors — arXiv-facing
    requests can get a 429 from shared CI IP ranges even when we're well within
    our own pacing, so this is about tolerating that, not fixing our own behavior.
    Capped wait and lower max_retries so one stuck request can't eat unbounded time."""
    for attempt in range(1, max_retries + 1):
        response = requests.get(url, headers={"User-Agent": USER_AGENT}, **kwargs)
        if response.status_code == 200:
            return response
        if response.status_code in (429, 500, 502, 503, 504) and attempt < max_retries:
            retry_after = response.headers.get("Retry-After")
            wait = int(retry_after) if retry_after and retry_after.isdigit() else min(2 ** attempt * 5, 30)
            print(f"    Got {response.status_code}, retrying in {wait}s (attempt {attempt}/{max_retries})...", flush=True)
            time.sleep(wait)
            continue
        response.raise_for_status()
    raise RuntimeError(f"Exceeded retries fetching {url}")


def fetch_latest_papers(category, max_results):
    url = (
        "http://export.arxiv.org/api/query"
        f"?search_query=cat:{category}"
        "&sortBy=submittedDate&sortOrder=descending"
        f"&start=0&max_results={max_results}"
    )
    response = request_with_retry(url)
    return feedparser.parse(response.content).entries


def clean_text(text):
    text = text.replace("\x00", "")
    return " ".join(text.split())


def parse_entry(entry):
    raw_id = entry.id.split("/abs/")[-1]
    arxiv_id = re.sub(r"v\d+$", "", raw_id)
    pdf_url = next(
        (link.href for link in entry.links if link.get("title") == "pdf"),
        f"https://arxiv.org/pdf/{arxiv_id}",
    )
    category = entry.get("arxiv_primary_category", {}).get("term", ARXIV_CATEGORY)
    published = datetime.strptime(entry.published, "%Y-%m-%dT%H:%M:%SZ").date()
    updated = datetime.strptime(entry.updated, "%Y-%m-%dT%H:%M:%SZ").date()
    return {
        "arxiv_id": arxiv_id,
        "title": clean_text(entry.title),
        "authors": [author.name for author in entry.authors],
        "abstract": clean_text(entry.summary),
        "category": category,
        "published_date": published.isoformat(),
        "updated_date": updated.isoformat(),
        "pdf_url": pdf_url,
    }


def get_existing_ids(arxiv_ids):
    if not arxiv_ids:
        return set()
    result = supabase.table("papers").select("arxiv_id").in_("arxiv_id", arxiv_ids).execute()
    return {row["arxiv_id"] for row in result.data}


def download_pdf(pdf_url):
    response = request_with_retry(pdf_url, timeout=30)
    return response.content


def extract_pages(pdf_bytes):
    """Returns a list of (page_number, text) tuples."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = [(i + 1, page.get_text()) for i, page in enumerate(doc)]
    doc.close()
    return pages


def chunk_text(text, chunk_words=CHUNK_WORDS, overlap=CHUNK_OVERLAP):
    words = text.split()
    if not words:
        return []
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_words
        chunks.append(" ".join(words[start:end]))
        start += chunk_words - overlap
    return chunks


def embed_texts(texts):
    return embedder.encode(texts).tolist()


def process_paper_fulltext(paper_id, pdf_url):
    """Download, parse, section-tag, chunk, and embed one paper's full text."""
    try:
        pdf_bytes = download_pdf(pdf_url)
    except Exception as e:
        print(f"Could not download PDF: {e}", flush=True)
        return []

    pages = extract_pages(pdf_bytes)

    chunk_rows = []
    current_section = None
    hit_references = False
    chunk_index = 0

    for page_number, page_text in pages:
        if hit_references:
            break

        kept_lines = []
        for line in page_text.split("\n"):
            if REFERENCES_PATTERN.match(line):
                hit_references = True
                break
            section_match = SECTION_PATTERN.match(line)
            if section_match:
                current_section = line.strip()
                continue
            kept_lines.append(line)

        page_content = clean_text(" ".join(kept_lines))
        if not page_content:
            continue

        for chunk in chunk_text(page_content):
            chunk_rows.append({
                "paper_id": paper_id,
                "section": current_section,
                "page_number": page_number,
                "chunk_index": chunk_index,
                "content": chunk,
            })
            chunk_index += 1

    if not chunk_rows:
        return []

    embeddings = embed_texts([row["content"] for row in chunk_rows])
    for row, embedding in zip(chunk_rows, embeddings):
        row["embedding"] = embedding

    return chunk_rows


def get_papers_without_chunks(paper_records):
    """Given paper rows, return the ones that have no chunks yet — covers
    both brand-new papers and ones that failed partway through last run."""
    if not paper_records:
        return []
    paper_ids = [p["id"] for p in paper_records]
    result = supabase.table("chunks").select("paper_id").in_("paper_id", paper_ids).execute()
    ids_with_chunks = {row["paper_id"] for row in result.data}
    return [p for p in paper_records if p["id"] not in ids_with_chunks]


def run():
    print(f"Fetching latest {PAPERS_PER_RUN} papers in {ARXIV_CATEGORY}...", flush=True)
    entries = fetch_latest_papers(ARXIV_CATEGORY, PAPERS_PER_RUN)
    parsed = [parse_entry(e) for e in entries]
    all_arxiv_ids = [p["arxiv_id"] for p in parsed]

    existing = get_existing_ids(all_arxiv_ids)
    new_papers = [p for p in parsed if p["arxiv_id"] not in existing]

    print(f"{len(parsed)} fetched, {len(existing)} already in the database, {len(new_papers)} new.", flush=True)

    if new_papers:
        supabase.table("papers").insert(new_papers).execute()
        print(f"Inserted {len(new_papers)} new papers.", flush=True)

    # Re-fetch full records for everything touched this run, so we also catch
    # any paper from a previous run whose chunking failed partway through.
    all_records = (
        supabase.table("papers")
        .select("id, title, pdf_url")
        .in_("arxiv_id", all_arxiv_ids)
        .execute()
        .data
    )
    to_process = get_papers_without_chunks(all_records)
    print(f"{len(to_process)} paper(s) need full-text processing (new or previously incomplete).", flush=True)

    for paper in to_process:
        print(f"  Processing: {paper['title'][:60]}...", flush=True)
        time.sleep(3)
        try:
            chunk_rows = process_paper_fulltext(paper["id"], paper["pdf_url"])
        except Exception as e:
            print(f"Failed to process this paper, skipping: {e}", flush=True)
            continue

        if not chunk_rows:
            print("No chunks extracted (PDF may have failed to parse).", flush=True)
            continue

        try:
            supabase.table("chunks").insert(chunk_rows).execute()
            print(f"Inserted {len(chunk_rows)} chunks.", flush=True)
        except Exception as e:
            print(f"Failed to insert chunks, skipping: {e}", flush=True)


if __name__ == "__main__":
    run()