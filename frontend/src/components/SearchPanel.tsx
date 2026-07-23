"use client";

import { useState, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown, AlertCircle, ExternalLink, SearchX } from "lucide-react";
import { searchPapers, SearchResult } from "@/lib/api";

const CATEGORIES = [
  { value: "", label: "all categories" },
  { value: "cs.AI", label: "cs.AI" },
  { value: "cs.LG", label: "cs.LG" },
  { value: "cs.CV", label: "cs.CV" },
  { value: "cs.CL", label: "cs.CL" },
  { value: "cs.RO", label: "cs.RO" },
  { value: "cs.CR", label: "cs.CR" },
  { value: "cs.SE", label: "cs.SE" },
  { value: "cs.MA", label: "cs.MA" },
  { value: "cs.SD", label: "cs.SD" },
];

const DATE_PRESETS = [
  { value: "", label: "any time" },
  { value: "7", label: "past week" },
  { value: "30", label: "past month" },
];

const EXAMPLE_QUERIES = [
  "reinforcement learning for job scheduling",
  "diffusion models for image generation",
  "transformer architectures for language models",
];

function dateFromPreset(days: string): string | undefined {
  if (!days) return undefined;
  const d = new Date();
  d.setDate(d.getDate() - parseInt(days, 10));
  return d.toISOString().split("T")[0];
}

function ResultCard({ result, index }: { result: SearchResult; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      whileHover={{ y: -4 }}
      className="rounded-lg border border-accent-soft bg-bg shadow-lg p-6 hover:border-accent transition-colors flex flex-col h-full"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        {result.section && (
          <span className="inline-block text-xs italic tracking-wide text-accent-fg bg-accent rounded px-2 py-0.5">
            {result.section}
          </span>
        )}
        <span className="text-xs text-fg/40 shrink-0">{result.published_date}</span>
      </div>
      {/* Title deliberately not italic — italics read fine as a singular
          emphasis moment (the hero, empty-state taglines) but hurt
          scanability across a dense grid of titles all at once. */}
      <h3 className="font-heading text-lg leading-snug mb-1.5">{result.title}</h3>
      <p className="text-xs text-accent dark:text-accent-soft mb-3">
        {result.authors.slice(0, 3).join(", ")}
        {result.authors.length > 3 ? " et al." : ""}
      </p>
      <p className="font-body text-sm text-fg/70 leading-relaxed mb-4 flex-1">
        {result.matching_snippet}
      </p>
      <a
        href={result.arxiv_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-accent dark:text-accent-soft hover:underline w-fit"
      >
        read on arxiv
        <ExternalLink size={11} />
      </a>
    </motion.div>
  );
}

function SkeletonCard({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-lg border border-accent-soft/30 bg-bg p-6"
    >
      <motion.div
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        className="space-y-3"
      >
        <div className="h-4 w-16 rounded bg-accent-soft/20" />
        <div className="h-5 w-4/5 rounded bg-accent-soft/20" />
        <div className="h-3 w-1/2 rounded bg-accent-soft/20" />
        <div className="h-3 w-full rounded bg-accent-soft/20" />
        <div className="h-3 w-full rounded bg-accent-soft/20" />
        <div className="h-3 w-2/3 rounded bg-accent-soft/20" />
      </motion.div>
    </motion.div>
  );
}

export default function SearchPanel() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [datePreset, setDatePreset] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async (q: string) => {
    if (!q.trim() || isLoading) return;
    setQuery(q);
    setIsLoading(true);
    setError(null);
    try {
      const data = await searchPapers(q, {
        category: category || undefined,
        date_from: dateFromPreset(datePreset),
      });
      setResults(data);
    } catch {
      setError("the server appears to be down. try again shortly.");
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    runSearch(query);
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-fg/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search across full paper text..."
            className="w-full bg-bg border border-accent-soft/40 focus:border-accent rounded-full pl-11 pr-4 py-3 text-sm text-fg placeholder:text-fg/40 outline-none transition-colors"
          />
        </div>
        <motion.button
          type="submit"
          disabled={isLoading || !query.trim()}
          whileHover={!isLoading && query.trim() ? { scale: 1.03 } : undefined}
          whileTap={!isLoading && query.trim() ? { scale: 0.97 } : undefined}
          className="bg-accent text-accent-fg font-medium px-6 py-3 rounded-full text-sm disabled:opacity-40 transition-opacity shrink-0"
        >
          search
        </motion.button>
      </form>

      <div className="flex flex-wrap items-center gap-3 mb-8">
        <div className="relative">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="appearance-none bg-accent-soft/10 border border-accent-soft/40 rounded-full pl-4 pr-9 py-2 text-xs uppercase tracking-wide text-fg/70 outline-none cursor-pointer hover:border-accent transition-colors"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg/40 pointer-events-none" />
        </div>

        <div className="flex gap-1.5">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setDatePreset(preset.value)}
              className={`text-xs px-3 py-2 rounded-full border transition-colors ${
                datePreset === preset.value
                  ? "bg-accent text-accent-fg border-accent"
                  : "border-accent-soft/40 text-fg/60 hover:border-accent"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <SkeletonCard key={i} index={i} />
            ))}
          </motion.div>
        )}

        {!isLoading && error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 border border-fg/20 rounded-lg px-4 py-3 text-sm text-fg/70"
          >
            <AlertCircle size={15} className="shrink-0" />
            {error}
          </motion.div>
        )}

        {!isLoading && !error && results !== null && results.length === 0 && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center text-center py-12 gap-2"
          >
            <SearchX size={22} className="text-fg/30 mb-1" />
            <p className="font-heading italic text-fg/60">no results for that query</p>
            <p className="text-sm text-fg/40">try a broader phrase, or clear the filters above</p>
          </motion.div>
        )}

        {!isLoading && !error && results !== null && results.length > 0 && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {results.map((r, i) => (
              <ResultCard key={r.arxiv_url} result={r} index={i} />
            ))}
          </motion.div>
        )}

        {!isLoading && !error && results === null && (
          <motion.div
            key="initial"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center text-center py-12 gap-4"
          >
            <p className="font-heading italic text-lg text-fg/60">search across the indexed papers</p>
            <div className="flex flex-col gap-2 w-full max-w-md">
              {EXAMPLE_QUERIES.map((q) => (
                <motion.button
                  key={q}
                  onClick={() => runSearch(q)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="text-sm text-left text-fg/70 border border-accent-soft/40 hover:border-accent rounded-md px-4 py-2.5 transition-colors"
                >
                  {q}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}