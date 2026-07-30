"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, AlertCircle, ExternalLink, X, Maximize2, Minimize2 } from "lucide-react";
import { askQuestion, AskSource, FigureResult } from "@/lib/api";

type Message =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; sources: AskSource[]; figure: FigureResult | null }
  | { role: "error"; content: string };

const EXAMPLE_QUESTIONS = [
  "what recent approaches use reinforcement learning for scheduling?",
  "how are diffusion models used for image generation?",
  "what optimizers are common for training large models?",
];

const bubblePop = {
  initial: { opacity: 0, scale: 0.7, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  transition: { type: "spring" as const, stiffness: 500, damping: 30 },
};

const layoutTransition = { type: "spring" as const, stiffness: 300, damping: 30 };

function TypingIndicator() {
  return (
    <motion.div
      {...bubblePop}
      className="inline-flex items-center gap-1 bg-accent-soft/15 rounded-full px-4 py-2.5"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full bg-fg/50"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </motion.div>
  );
}

function SourceChip({ source }: { source: AskSource }) {
  return (
    <motion.a
      href={`https://arxiv.org/abs/${source.arxiv_id}`}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="flex items-center gap-1.5 text-xs border border-accent-soft/50 hover:border-accent rounded-md px-2.5 py-1.5 text-fg/70 hover:text-accent dark:hover:text-accent-soft transition-colors cursor-pointer"
    >
      <span className="truncate max-w-[180px]">{source.title}</span>
      {source.section && (
        <span className="text-accent dark:text-accent-soft uppercase text-[10px] tracking-wide shrink-0">
          {source.section}
        </span>
      )}
      <ExternalLink size={11} className="shrink-0 opacity-60" />
    </motion.a>
  );
}

function FigureCard({ figure }: { figure: FigureResult }) {
  return (
    <motion.a
      href={figure.arxiv_url}
      target="_blank"
      rel="noopener noreferrer"
      {...bubblePop}
      whileHover={{ scale: 1.02 }}
      className="block max-w-xs rounded-lg overflow-hidden border border-accent-soft/40 hover:border-accent bg-accent-soft/5 transition-colors cursor-pointer"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={figure.storage_path}
        alt={figure.caption ?? figure.title}
        className="w-full object-cover"
      />
      {figure.caption && (
        <p className="text-[11px] text-fg/60 leading-snug px-3 py-2">{figure.caption}</p>
      )}
    </motion.a>
  );
}

interface AskChatProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export default function AskChat({ isExpanded, onToggleExpand }: AskChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) return;
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const submitQuestion = async (question: string) => {
    if (!question.trim() || isLoading) return;
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setIsLoading(true);
    try {
      const res = await askQuestion(question);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.answer, sources: res.sources, figure: res.figure },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "error", content: "the server appears to be down. try again shortly." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submitQuestion(input);
  };

  return (
    <motion.div
      layout
      transition={{ layout: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }}
      className="w-full flex flex-col h-[70vh] border border-accent-soft/30 rounded-lg overflow-hidden bg-bg shadow-xl"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-accent-soft/20 bg-accent-soft/5 shrink-0">
        <button
          type="button"
          aria-label="Close"
          className="group relative w-3 h-3 rounded-full bg-[#ff5f57] flex items-center justify-center cursor-default"
        >
          <X size={7} strokeWidth={3} className="text-[#4d0000] opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <button
          type="button"
          aria-label={isExpanded ? "Restore" : "Expand"}
          onClick={onToggleExpand}
          className="group relative w-3 h-3 rounded-full bg-[#28c840] flex items-center justify-center cursor-pointer"
        >
          {isExpanded ? (
            <Minimize2 size={7} strokeWidth={3} className="text-[#0f4d17] opacity-0 group-hover:opacity-100 transition-opacity" />
          ) : (
            <Maximize2 size={7} strokeWidth={3} className="text-[#0f4d17] opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </button>
        <span className="flex-1 text-center text-xs text-fg/40 pr-14">ask — arxiv explorer</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 flex flex-col">
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full flex flex-col items-center justify-center text-center px-6"
          >
            <p className="font-heading italic text-xl text-fg/60 mb-6">
              ask anything about the indexed papers
            </p>
            <div className="flex flex-col gap-2 w-full max-w-md">
              {EXAMPLE_QUESTIONS.map((q, i) => (
                <motion.button
                  key={q}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  onClick={() => submitQuestion(q)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="text-sm text-left text-fg/70 border border-accent-soft/40 hover:border-accent rounded-md px-4 py-2.5 transition-colors cursor-pointer"
                >
                  {q}
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="mt-auto flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  layout
                  transition={{ layout: layoutTransition }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "user" && (
                    <motion.div
                      {...bubblePop}
                      className="max-w-[80%] bg-accent text-accent-fg shadow-sm rounded-tl-[18px] rounded-tr-[18px] rounded-bl-[18px] rounded-br-[4px] px-4 py-2.5 text-sm"
                    >
                      {msg.content}
                    </motion.div>
                  )}

                  {msg.role === "assistant" && (
                    <div className="max-w-[85%] flex flex-col gap-2">
                      <motion.div
                        {...bubblePop}
                        className="bg-accent-soft/10 border border-accent-soft/30 shadow-sm rounded-tl-[18px] rounded-tr-[18px] rounded-br-[18px] rounded-bl-[4px] px-4 py-3 text-sm text-fg leading-relaxed"
                      >
                        {msg.content}
                      </motion.div>
                      {msg.figure && <FigureCard figure={msg.figure} />}
                      {msg.sources.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.15 }}
                          className="flex flex-wrap gap-1.5 pl-1"
                        >
                          {msg.sources.map((s) => (
                            <SourceChip key={s.arxiv_id} source={s} />
                          ))}
                        </motion.div>
                      )}
                    </div>
                  )}

                  {msg.role === "error" && (
                    <motion.div
                      {...bubblePop}
                      className="flex items-center gap-2 max-w-[85%] border border-fg/20 shadow-sm rounded-tl-[18px] rounded-tr-[18px] rounded-br-[18px] rounded-bl-[4px] px-4 py-2.5 text-sm text-fg/70"
                    >
                      <AlertCircle size={15} className="shrink-0" />
                      {msg.content}
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {isLoading && (
              <div className="flex justify-start">
                <TypingIndicator />
              </div>
            )}
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-accent-soft/20 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="ask a question about the indexed papers..."
          disabled={isLoading}
          className="flex-1 bg-transparent text-sm text-fg placeholder:text-fg/40 outline-none px-3 py-2"
        />
        <motion.button
          type="submit"
          disabled={isLoading || !input.trim()}
          whileHover={!isLoading && input.trim() ? { scale: 1.08 } : undefined}
          whileTap={!isLoading && input.trim() ? { scale: 0.92 } : undefined}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-accent text-accent-fg disabled:opacity-40 transition-opacity cursor-pointer disabled:cursor-not-allowed"
        >
          <Send size={15} />
        </motion.button>
      </form>
    </motion.div>
  );
}