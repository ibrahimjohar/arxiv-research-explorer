"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown, ChevronLeft, ChevronRight, AlertCircle, ExternalLink, SearchX } from "lucide-react";
import { searchPapers, SearchResult } from "@/lib/api";
import { useState, useRef, useEffect, FormEvent } from "react";

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

// Slide direction is tracked separately from index so entering/exiting cards
// know which side to animate from/to — standard carousel pattern.
const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -60 : 60, opacity: 0 }),
};

function ResultCard({ result }: { result: SearchResult }) {
  return (
    // overflow-hidden as a hard backstop, break-words on every text element
    // as the actual fix — garbled/unbroken character runs (a known PDF
    // extraction artifact, not a frontend bug) can no longer spill past
    // the card border regardless of how long or space-free they are.
    <div className="rounded-lg border border-accent-soft bg-bg shadow-lg p-6 sm:p-8 flex flex-col h-full overflow-hidden">
      <div className="flex items-start justify-between gap-3 mb-4">
        {result.section && (
          <span className="inline-block text-xs italic tracking-wide text-accent-fg bg-accent rounded px-2 py-0.5 break-words">
            {result.section}
          </span>
        )}
        <span className="text-xs text-fg/40 shrink-0">{result.published_date}</span>
      </div>
      <h3 className="font-heading text-xl sm:text-2xl leading-snug mb-2 break-words">{result.title}</h3>
      <p className="text-sm text-accent dark:text-accent-soft mb-4 break-words">
        {result.authors.slice(0, 4).join(", ")}
        {result.authors.length > 4 ? " et al." : ""}
      </p>
      <p className="font-body text-sm sm:text-base text-fg/70 leading-relaxed break-words overflow-y-auto flex-1 pr-1">
        {result.matching_snippet}
      </p>
      <a
        href={result.arxiv_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-accent dark:text-accent-soft hover:underline w-fit mt-4 shrink-0"
      >
        read on arxiv
        <ExternalLink size={11} />
      </a>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-accent-soft/30 bg-bg p-6 sm:p-8 h-full flex flex-col justify-center">
      <motion.div
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        className="space-y-4"
      >
        <div className="h-4 w-20 rounded bg-accent-soft/20" />
        <div className="h-7 w-3/4 rounded bg-accent-soft/20" />
        <div className="h-4 w-1/3 rounded bg-accent-soft/20" />
        <div className="h-3 w-full rounded bg-accent-soft/20" />
        <div className="h-3 w-full rounded bg-accent-soft/20" />
        <div className="h-3 w-2/3 rounded bg-accent-soft/20" />
      </motion.div>
    </div>
  );
}

function CategoryDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-accent-soft/10 border border-accent-soft/40 rounded-full pl-4 pr-3 py-2 text-xs uppercase tracking-wide text-fg/70 hover:border-accent transition-colors"
      >
        {selected.label}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={13} className="text-fg/40" />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-2 w-44 rounded-lg border border-accent-soft bg-bg shadow-xl overflow-hidden z-20 py-1"
          >
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  onChange(c.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-xs uppercase tracking-wide transition-colors ${
                  c.value === value ? "bg-accent text-accent-fg" : "text-fg/70 hover:bg-accent-soft/10"
                }`}
              >
                {c.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SearchPanel() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [datePreset, setDatePreset] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const runSearch = async (q: string) => {
    if (!q.trim() || isLoading) return;
    setQuery(q);
    setIsLoading(true);
    setError(null);
    setIndex(0);
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

  const goNext = () => {
    if (!results || index >= results.length - 1) return;
    setDirection(1);
    setIndex((i) => i + 1);
  };

  const goPrev = () => {
    if (index <= 0) return;
    setDirection(-1);
    setIndex((i) => i - 1);
  };

  return (
    // Fixed h-[70vh] shell, identical to AskChat's — this is the actual fix
    // for the page-height jump when switching modes. Every internal state
    // (initial prompt, loading, a single result, error) lives inside the
    // same flex-1 centered area below, so none of them can change the
    // panel's overall footprint.
    <div className="w-full flex flex-col h-[70vh] border border-accent-soft/30 rounded-lg overflow-hidden bg-bg shadow-xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-accent-soft/20 bg-accent-soft/5 shrink-0">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        <span className="flex-1 text-center text-xs text-fg/40 pr-14">search — arxiv explorer</span>
      </div>

      <div className="px-4 sm:px-6 pt-5 pb-4 shrink-0">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-fg/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search across full paper text..."
              className="w-full bg-bg border border-accent-soft/40 focus:border-accent rounded-full pl-11 pr-4 py-2.5 text-sm text-fg placeholder:text-fg/40 outline-none transition-colors"
            />
          </div>
          <motion.button
            type="submit"
            disabled={isLoading || !query.trim()}
            whileHover={!isLoading && query.trim() ? { scale: 1.03 } : undefined}
            whileTap={!isLoading && query.trim() ? { scale: 0.97 } : undefined}
            className="bg-accent text-accent-fg font-medium px-6 py-2.5 rounded-full text-sm disabled:opacity-40 transition-opacity shrink-0"
          >
            search
          </motion.button>
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <CategoryDropdown value={category} onChange={setCategory} />

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
      </div>

      <div className="flex-1 overflow-hidden px-4 sm:px-6 pb-6 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {isLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full"
            >
              <SkeletonCard />
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
              className="flex flex-col items-center text-center gap-2"
            >
              <SearchX size={22} className="text-fg/30 mb-1" />
              <p className="font-heading italic text-fg/60">no results for that query</p>
              <p className="text-sm text-fg/40">try a broader phrase, or clear the filters above</p>
            </motion.div>
          )}

          {!isLoading && !error && results !== null && results.length > 0 && (
            <motion.div key="carousel" className="w-full h-full flex flex-col">
              <div className="relative flex-1 overflow-hidden">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={index}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                    className="absolute inset-0"
                  >
                    <ResultCard result={results[index]} />
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="flex items-center justify-center gap-4 pt-4 shrink-0">
                <motion.button
                  onClick={goPrev}
                  disabled={index === 0}
                  whileHover={index > 0 ? { scale: 1.1 } : undefined}
                  whileTap={index > 0 ? { scale: 0.9 } : undefined}
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-accent-soft/40 text-fg/60 hover:border-accent hover:text-accent dark:hover:text-accent-soft disabled:opacity-30 disabled:hover:border-accent-soft/40 transition-colors"
                >
                  <ChevronLeft size={16} />
                </motion.button>
                <span className="text-xs text-fg/50 tabular-nums">
                  {index + 1} / {results.length}
                </span>
                <motion.button
                  onClick={goNext}
                  disabled={index === results.length - 1}
                  whileHover={index < results.length - 1 ? { scale: 1.1 } : undefined}
                  whileTap={index < results.length - 1 ? { scale: 0.9 } : undefined}
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-accent-soft/40 text-fg/60 hover:border-accent hover:text-accent dark:hover:text-accent-soft disabled:opacity-30 disabled:hover:border-accent-soft/40 transition-colors"
                >
                  <ChevronRight size={16} />
                </motion.button>
              </div>
            </motion.div>
          )}

          {!isLoading && !error && results === null && (
            <motion.div
              key="initial"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center text-center gap-4 w-full max-w-md"
            >
              <p className="font-heading italic text-lg text-fg/60">search across the indexed papers</p>
              <div className="flex flex-col gap-2 w-full">
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
    </div>
  );
}