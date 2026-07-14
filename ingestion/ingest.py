import os
import re
from datetime import datetime

import requests
import feedparser
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

ARXIV_CATEGORY = "cs.AI"
PAPERS_PER_RUN = 20
USER_AGENT = "arxiv-research-explorer/0.1 (portfolio project; contact: k230074@nu.edu.pk)"


def fetch_latest_papers(category, max_results):
    #ask arXiv for the newest papers in a category
    url = (
        "http://export.arxiv.org/api/query"
        f"?search_query=cat:{category}"
        "&sortBy=submittedDate&sortOrder=descending"
        f"&start=0&max_results={max_results}"
    )
    response = requests.get(url, headers={"User-Agent": USER_AGENT})
    response.raise_for_status()
    feed = feedparser.parse(response.content)
    return feed.entries


def clean_text(text):
    #Collapse the newlines/extra spaces arXiv's XML wraps text in.
    return " ".join(text.split())


def parse_entry(entry):
    #turn one arXiv feed entry into the fields our papers table expects.
    raw_id = entry.id.split("/abs/")[-1]
    arxiv_id = re.sub(r"v\d+$", "", raw_id)  #drop the version suffix, e.g. v2

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
    #ask supabase which of these arXiv IDs we already have, so we skip duplicates.
    if not arxiv_ids:
        return set()
    result = supabase.table("papers").select("arxiv_id").in_("arxiv_id", arxiv_ids).execute()
    return {row["arxiv_id"] for row in result.data}


def run():
    print(f"Fetching latest {PAPERS_PER_RUN} papers in {ARXIV_CATEGORY}...")
    entries = fetch_latest_papers(ARXIV_CATEGORY, PAPERS_PER_RUN)
    parsed = [parse_entry(e) for e in entries]

    existing = get_existing_ids([p["arxiv_id"] for p in parsed])
    new_papers = [p for p in parsed if p["arxiv_id"] not in existing]

    print(f"{len(parsed)} fetched, {len(existing)} already in the database, {len(new_papers)} new.")

    if new_papers:
        supabase.table("papers").insert(new_papers).execute()
        print(f"Inserted {len(new_papers)} new papers.")
    else:
        print("Nothing new to insert.")


if __name__ == "__main__":
    run()