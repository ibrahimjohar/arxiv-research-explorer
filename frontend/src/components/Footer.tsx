import { Mail } from "lucide-react";

export default function Footer() {
  return (
    <footer className="relative border-t border-accent-soft/40">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 md:px-16 lg:px-24 py-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <div className="font-heading italic text-lg text-accent dark:text-accent-soft">
            arxiv explorer
          </div>
          <p className="mt-1 text-xs text-fg/40 font-body">
            hybrid search and retrieval-augmented q&a over cs.ai papers
          </p>
        </div>

        <div className="flex items-center gap-5">
          <a
            href="https://github.com/ibrahimjohar/arxiv-research-explorer"
            aria-label="GitHub"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-fg/40 hover:text-accent dark:hover:text-accent-soft hover:scale-110 transition-all duration-200"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.4 7.86 10.93.57.1.78-.25.78-.55 0-.27-.01-1.16-.02-2.1-3.2.7-3.87-1.36-3.87-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.7 5.39-5.26 5.67.41.36.78 1.07.78 2.16 0 1.56-.01 2.82-.01 3.2 0 .31.2.66.79.55A10.52 10.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
            </svg>
          </a>

          <a
            href="https://linkedin.com/in/your-handle"
            aria-label="LinkedIn"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-fg/40 hover:text-accent dark:hover:text-accent-soft hover:scale-110 transition-all duration-200"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.15 1.45-2.15 2.94v5.67H9.34V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45Z" />
            </svg>
          </a>

          <a
            href="mailto:you@example.com"
            aria-label="Email"
            className="inline-block text-fg/40 hover:text-accent dark:hover:text-accent-soft hover:scale-110 transition-all duration-200"
          >
            <Mail size={18} />
          </a>
        </div>
      </div>

      <div className="border-t border-accent-soft/40">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 md:px-16 lg:px-24 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-fg/40 font-body">
          <span>ibrahim johar · 2026</span>
          <span>
            thank you to{" "}
            <a
              href="https://arxiv.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted hover:text-accent dark:hover:text-accent-soft transition-colors"
            >
              arxiv
            </a>{" "}
            for use of its open access interoperability.
          </span>
        </div>
      </div>
    </footer>
  );
}