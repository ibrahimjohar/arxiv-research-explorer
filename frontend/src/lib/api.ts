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

export async function askQuestion(question: string, filters?: Filters): Promise<AskResponse> {
  const res = await fetch(`${API_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, ...filters }),
  });
  if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
  return res.json();
}

export async function searchPapers(query: string, filters?: Filters): Promise<SearchResult[]> {
  const res = await fetch(`${API_URL}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, ...filters }),
  });
  if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
  const data = await res.json();
  return data.results;
}