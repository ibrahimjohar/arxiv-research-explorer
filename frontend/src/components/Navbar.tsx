"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";

// Adjust these independently to resize the two words of the wordmark
const LOGO_PRIMARY_SIZE = "text-[25px]"; // "arxiv"
const LOGO_SECONDARY_SIZE = "text-[25px]"; // "explorer"

function GithubIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function LogoMark() {
  return (
    <svg width={24} height={24} viewBox="0 0 20 20" aria-hidden="true">
      <line x1="4" y1="14" x2="15" y2="6" stroke="currentColor" strokeWidth="1" className="text-accent-soft" />
      <circle cx="4" cy="14" r="2.5" fill="currentColor" className="text-accent-soft" />
      <circle cx="15" cy="6" r="2.5" fill="currentColor" className="text-accent" />
    </svg>
  );
}

function ThemeToggle() {
  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <motion.button
      onClick={toggle}
      aria-label="Toggle theme"
      whileHover={{ scale: 1.12, rotate: -12 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: "spring", stiffness: 400, damping: 15 }}
      className="relative w-7 h-7 flex items-center justify-center text-fg/60 hover:text-accent dark:hover:text-accent-soft transition-colors"
    >
      <Sun size={18} className="absolute transition-opacity duration-200 opacity-100 dark:opacity-0" />
      <Moon size={18} className="absolute transition-opacity duration-200 opacity-0 dark:opacity-100" />
    </motion.button>
  );
}

export default function Navbar() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-40 w-full border-b border-accent-soft/20 bg-bg/70 backdrop-blur-md"
    >
      <div className="flex items-center justify-between px-6 sm:px-10 md:px-16 lg:px-24 h-20">
        <motion.div whileHover={{ x: 2 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="flex items-baseline gap-2">
                <span className={`font-heading ${LOGO_PRIMARY_SIZE} text-fg tracking-tighter`}>arXiv</span>
                <span className={`font-heading ${LOGO_PRIMARY_SIZE} tracking-tighter text-accent dark:text-accent-soft italic font-light`}>
                    explorer
                </span>
            </span>
          </Link>
        </motion.div>

        <div className="flex items-center gap-6">
          <motion.a
            href="https://github.com/ibrahimjohar/arxiv-research-explorer"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="text-fg/60 hover:text-accent dark:hover:text-accent-soft transition-colors"
          >
            <GithubIcon size={18} />
          </motion.a>
          <ThemeToggle />
        </div>
      </div>
    </motion.header>
  );
}