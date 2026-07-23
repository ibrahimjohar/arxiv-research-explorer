const API_URL = process.env.NEXT_PUBLIC_API_URL;

export type SearchResult = {
  title: string;
  authors: string[];
  published_date: string;
  section: string | null;
  matching_snippet: string;
  arxiv_url: string;
};

export type AskSource = {
  title: string;
  arxiv_id: string;
  section: string | null;
};

export type AskResponse = {
  answer: string;
  sources: AskSource[];
};

type Filters = { category?: string; date_from?: string; date_to?: string };

// Retries silently on network failure or 502/503/504 — these are exactly the
// signatures of a server that's still waking up (a cold start), not a genuine
// outage. Total delay budget (~49s) is sized to cover Render's documented
// 30-60s free-tier wake-up window. Non-retryable errors (4xx, etc.) are
// returned immediately rather than retried, since retrying won't fix those.
const RETRY_DELAYS_MS = [2000, 4000, 8000, 15000, 20000];

async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if ([502, 503, 504].includes(res.status) && attempt < RETRY_DELAYS_MS.length) {
        lastError = new Error(`Server warming up (status ${res.status})`);
      } else {
        return res; // a real 4xx/other error — let the caller handle it, don't retry
      }
    } catch (err) {
      lastError = err; // connection refused / DNS fail — likely still starting up
    }
    if (attempt < RETRY_DELAYS_MS.length) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
  throw lastError;
}

export async function askQuestion(question: string, filters?: Filters): Promise<AskResponse> {
  const res = await fetchWithRetry(`${API_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, ...filters }),
  });
  if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
  return res.json();
}

export async function searchPapers(query: string, filters?: Filters): Promise<SearchResult[]> {
  const res = await fetchWithRetry(`${API_URL}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, ...filters }),
  });
  if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
  const data = await res.json();
  //the backend returns a raw JSON array directly (response_model=List[SearchResult]),
  //not wrapped in a { results: [...] } object — Array.isArray as a safety net in
  //case that ever changes on the backend side without this being updated to match.
  return Array.isArray(data) ? data : [];
}