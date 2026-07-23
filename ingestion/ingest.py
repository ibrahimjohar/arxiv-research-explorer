import io
import os
import re
import time
from datetime import datetime, timezone

import requests
import feedparser
import fitz  # PyMuPDF
from PIL import Image
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
MIN_CHUNK_WORDS = 40  # below this, a "chunk" is almost certainly title/header noise — discarded outright

FIGURES_BUCKET = "figures"
MIN_FIGURE_DIM = 100  # px — below this, almost certainly a logo/icon/decorative separator, not a real figure
MAX_FIGURE_DIM = 800  # px — resized down to this to conserve the 1GB Storage quota

SECTION_PATTERN = re.compile(
    r"^\s*(\d+\.?\d*\.?\s*|[IVXLC]+\.?\s*)?"
    r"(abstract|introduction|background|related work|methodology|method|approach|"
    r"experiments?( and results)?|evaluation|results?|discussion|"
    r"conclusions?|limitations|future work)\s*$",
    re.IGNORECASE,
)
REFERENCES_PATTERN = re.compile(r"^\s*(\d+\.?\s*)?(references|bibliography)\s*$", re.IGNORECASE)
FIGURE_CAPTION_PATTERN = re.compile(r"^\s*(Fig(?:ure)?\.?\s*\d+)\s*[:.]?\s*(.*)$", re.IGNORECASE | re.DOTALL)

print("Loading embedding model...", flush=True)
embedder = SentenceTransformer("all-MiniLM-L6-v2")

print("Loading CLIP model for figure embeddings...", flush=True)
clip_embedder = SentenceTransformer("clip-ViT-B-32")


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


def extract_text_chunks(doc, paper_id):
    """Same chunking/section logic as before, now operating on an already-open
    fitz doc instead of re-opening it — shares one download+parse pass with
    figure extraction rather than downloading the same PDF twice."""
    chunk_rows = []
    current_section = None
    hit_references = False
    chunk_index = 0

    for page_index in range(len(doc)):
        if hit_references:
            break
        page_number = page_index + 1
        page_text = doc[page_index].get_text()

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
            if len(chunk.split()) < MIN_CHUNK_WORDS:
                continue  # too short to be real content — almost certainly title/header noise
            chunk_rows.append({
                "paper_id": paper_id,
                "section": current_section,
                "page_number": page_number,
                "chunk_index": chunk_index,
                "content": chunk,
            })
            chunk_index += 1

    return chunk_rows


def find_caption_near(text_blocks, img_bbox, max_distance=80):
    """Best-effort: find a 'Figure N'/'Fig. N' caption block vertically close
    to the image on the same page. Captions can sit above or below a figure,
    span columns, or not be detected at all — this is a heuristic, not a
    guarantee, same spirit as the section-detection regex."""
    best_caption = None
    best_distance = max_distance
    for (x0, y0, x1, y1, text) in text_blocks:
        if not FIGURE_CAPTION_PATTERN.match(text.strip()):
            continue
        distance = min(abs(y0 - img_bbox.y1), abs(img_bbox.y0 - y1))
        if distance < best_distance:
            best_distance = distance
            best_caption = clean_text(text)
    return best_caption


def extract_figures(doc):
    """Extract qualifying embedded images with best-effort captions, resized
    and re-encoded as JPEG. Returns raw candidates — upload to Storage and
    CLIP embedding happen in a separate step, since those involve network
    calls rather than pure PDF parsing."""
    figures = []

    for page_index in range(len(doc)):
        page = doc[page_index]
        page_number = page_index + 1
        text_blocks = [
            (b[0], b[1], b[2], b[3], b[4])
            for b in page.get_text("blocks")
            if b[4].strip()
        ]

        for img in page.get_images(full=True):
            xref = img[0]
            try:
                base_image = doc.extract_image(xref)
                pil_image = Image.open(io.BytesIO(base_image["image"]))
                pil_image.load()
            except Exception:
                continue  # a small number of embedded images fail to decode — skip, don't crash the run

            if pil_image.width < MIN_FIGURE_DIM or pil_image.height < MIN_FIGURE_DIM:
                continue  # almost certainly a logo/icon/decorative separator

            caption = None
            try:
                img_bbox = page.get_image_bbox(img)
                caption = find_caption_near(text_blocks, img_bbox)
            except Exception:
                pass  # caption stays None — not fatal, figures without captions are still stored

            resized = pil_image.convert("RGB")
            resized.thumbnail((MAX_FIGURE_DIM, MAX_FIGURE_DIM))
            buf = io.BytesIO()
            resized.save(buf, format="JPEG", quality=85)

            figures.append({
                "page_number": page_number,
                "caption": caption,
                "pil_image": resized,
                "jpeg_bytes": buf.getvalue(),
            })

    return figures


def upload_and_embed_figures(paper_id, arxiv_id, figures):
    """Uploads each qualifying figure to Supabase Storage and embeds it with
    CLIP, returning rows ready for insertion into the figures table."""
    rows = []
    for i, fig in enumerate(figures):
        path = f"{arxiv_id}/{i}.jpg"
        try:
            supabase.storage.from_(FIGURES_BUCKET).upload(
                path,
                fig["jpeg_bytes"],
                {"content-type": "image/jpeg", "upsert": "true"},
            )
            public_url = supabase.storage.from_(FIGURES_BUCKET).get_public_url(path)
        except Exception as e:
            print(f"    Failed to upload figure {i}: {e}", flush=True)
            continue

        embedding = clip_embedder.encode(fig["pil_image"]).tolist()

        rows.append({
            "paper_id": paper_id,
            "page_number": fig["page_number"],
            "caption": fig["caption"],
            "storage_path": public_url,
            "embedding": embedding,
        })
    return rows


def process_paper(pdf_url, paper_id):
    """Download once, extract both text chunks and figure candidates from the
    same PDF pass, embed the text chunks. Raises on download/parse failure —
    the caller's try/except handles that, same as before; a paper that fails
    here stays eligible for retry next run rather than being marked done."""
    pdf_bytes = download_pdf(pdf_url)

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    chunk_rows = extract_text_chunks(doc, paper_id)
    raw_figures = extract_figures(doc)
    doc.close()

    if chunk_rows:
        embeddings = embed_texts([row["content"] for row in chunk_rows])
        for row, embedding in zip(chunk_rows, embeddings):
            row["embedding"] = embedding

    return chunk_rows, raw_figures


def get_papers_needing_processing(paper_records):
    """Returns papers missing chunks and/or never processed for figures.
    figures_processed_at — not 'has any figure rows' — is what marks a paper
    done for figures, since many papers legitimately have zero usable images;
    using row-count alone would re-download those forever."""
    if not paper_records:
        return []
    paper_ids = [p["id"] for p in paper_records]
    chunks_result = supabase.table("chunks").select("paper_id").in_("paper_id", paper_ids).execute()
    ids_with_chunks = {row["paper_id"] for row in chunks_result.data}
    return [
        p for p in paper_records
        if p["id"] not in ids_with_chunks or p.get("figures_processed_at") is None
    ]


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

    all_records = (
        supabase.table("papers")
        .select("id, arxiv_id, title, pdf_url, figures_processed_at")
        .execute()
        .data
    )
    to_process = get_papers_needing_processing(all_records)[:3]
    print(f"{len(to_process)} paper(s) need processing (text and/or figures).", flush=True)

    for paper in to_process:
        print(f"  Processing: {paper['title'][:60]}...", flush=True)
        time.sleep(3)
        try:
            chunk_rows, raw_figures = process_paper(paper["pdf_url"], paper["id"])
        except Exception as e:
            print(f"    Failed to process this paper, skipping: {e}", flush=True)
            continue

        if chunk_rows:
            try:
                supabase.table("chunks").insert(chunk_rows).execute()
                print(f"    Inserted {len(chunk_rows)} chunks.", flush=True)
            except Exception as e:
                print(f"    Failed to insert chunks, skipping: {e}", flush=True)
        else:
            print("    No chunks extracted (PDF may have failed to parse).", flush=True)

        figure_rows = upload_and_embed_figures(paper["id"], paper["arxiv_id"], raw_figures) if raw_figures else []
        if figure_rows:
            try:
                supabase.table("figures").insert(figure_rows).execute()
                print(f"    Inserted {len(figure_rows)} figures.", flush=True)
            except Exception as e:
                print(f"    Failed to insert figures, skipping: {e}", flush=True)
        else:
            print("    No qualifying figures found.", flush=True)

        # Mark figures as processed regardless of whether any qualified —
        # this is what stops us re-downloading forever for papers that
        # legitimately have zero usable images.
        try:
            supabase.table("papers").update(
                {"figures_processed_at": datetime.now(timezone.utc).isoformat()}
            ).eq("id", paper["id"]).execute()
        except Exception as e:
            print(f"    Failed to mark figures as processed: {e}", flush=True)


if __name__ == "__main__":
    run()