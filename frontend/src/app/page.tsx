"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import AskChat from "@/components/AskChat";
import SearchPanel from "@/components/SearchPanel";

const previewChunks = [
  { section: "introduction", snippet: "we propose a dual-attention framework for..." },
  { section: "method", snippet: "the policy is trained with proximal policy optimization..." },
  { section: "results", snippet: "this reduces error by a wide margin across all..." },
];

type Node = { id: string; x: number; y: number };

const initialNodes: Node[] = [
  { id: "a", x: 8, y: 79 }, { id: "b", x: 22, y: 69 }, { id: "c", x: 15, y: 93 },
  { id: "d", x: 42, y: 89 }, { id: "e", x: 62, y: 14 }, { id: "f", x: 76, y: 31 },
  { id: "g", x: 88, y: 49 }, { id: "h", x: 70, y: 69 }, { id: "i", x: 90, y: 86 },
  { id: "j", x: 50, y: 9 }, { id: "k", x: 35, y: 31 }, { id: "l", x: 58, y: 58 },
  { id: "m", x: 24, y: 44 }, { id: "n", x: 46, y: 42 }, { id: "o", x: 80, y: 78 },
  { id: "p", x: 12, y: 24 }, { id: "q", x: 95, y: 18 },
];

const edgePool: [string, string][] = [
  ["a", "b"], ["b", "c"], ["b", "m"], ["d", "c"], ["d", "o"], ["e", "f"],
  ["f", "g"], ["g", "h"], ["g", "q"], ["e", "j"], ["k", "j"],
  ["h", "i"], ["h", "o"], ["i", "o"], ["l", "n"],
  ["n", "k"], ["n", "e"], ["j", "q"], ["a", "m"], ["c", "a"],
  ["p", "m"], ["q", "i"], ["l", "p"],
];

const paperInfo: Record<string, { title: string; authors: string; blurb: string }> = {
  a: { title: "Attention Is All You Need", authors: "Vaswani et al., 2017", blurb: "we propose the transformer, a network architecture based solely on attention, dispensing with recurrence and convolutions entirely." },
  b: { title: "Deep Residual Learning for Image Recognition", authors: "He et al., 2016", blurb: "we reformulate the layers as learning residual functions, easing the training of substantially deeper networks." },
  c: { title: "Generative Adversarial Networks", authors: "Goodfellow et al., 2014", blurb: "we train two models simultaneously: a generator capturing the data distribution, and a discriminator estimating the probability a sample came from it." },
  d: { title: "Playing Atari with Deep Reinforcement Learning", authors: "Mnih et al., 2013", blurb: "a convolutional network trained with a variant of q-learning, taking raw pixels as input and outputting a value function." },
  e: { title: "BERT: Pre-training of Deep Bidirectional Transformers", authors: "Devlin et al., 2018", blurb: "we pretrain deep bidirectional representations by jointly conditioning on both left and right context in all layers." },
  f: { title: "Adam: A Method for Stochastic Optimization", authors: "Kingma & Ba, 2014", blurb: "an efficient first-order optimizer requiring only modest memory, now the default choice for training deep networks." },
  g: { title: "Denoising Diffusion Probabilistic Models", authors: "Ho et al., 2020", blurb: "a class of generative models trained via a gradual denoising process, underlying most modern image diffusion systems." },
  h: { title: "Proximal Policy Optimization Algorithms", authors: "Schulman et al., 2017", blurb: "policy gradient methods that alternate between sampling data and optimizing a surrogate objective, simpler to tune than prior approaches." },
  i: { title: "ImageNet Classification with Deep Convolutional Neural Networks", authors: "Krizhevsky et al., 2012", blurb: "a large, deep convolutional network that substantially outperformed prior approaches, credited with reviving interest in deep learning." },
  j: { title: "Sequence to Sequence Learning with Neural Networks", authors: "Sutskever et al., 2014", blurb: "a general end-to-end approach mapping one sequence to another with a multilayered recurrent encoder and decoder." },
  k: { title: "Auto-Encoding Variational Bayes", authors: "Kingma & Welling, 2013", blurb: "a stochastic variational inference algorithm that scales to large datasets under mild differentiability conditions." },
  l: { title: "Layer Normalization", authors: "Ba et al., 2016", blurb: "a normalization technique computed across features for a single training case, stabilizing and speeding up training." },
  m: { title: "Distributed Representations of Words and Phrases", authors: "Mikolov et al., 2013", blurb: "extensions that improve embedding quality and training speed, including subsampling of frequent words." },
  n: { title: "Neural Machine Translation by Jointly Learning to Align and Translate", authors: "Bahdanau et al., 2014", blurb: "a fixed-length vector is a bottleneck; we propose to jointly learn to align and translate instead." },
  o: { title: "Dropout: A Simple Way to Prevent Neural Networks from Overfitting", authors: "Srivastava et al., 2014", blurb: "randomly dropping units during training prevents complex co-adaptations and reduces overfitting." },
  p: { title: "Language Models are Few-Shot Learners", authors: "Brown et al., 2020", blurb: "scaling up language models greatly improves task-agnostic, few-shot performance, at times matching fine-tuned approaches." },
  q: { title: "Batch Normalization", authors: "Ioffe & Szegedy, 2015", blurb: "normalizing layer inputs per mini-batch allows much higher learning rates and less sensitivity to initialization." },
};

const REST_MS = 7500;
const MOVE_MS = 2600;

function resolveOverlap(input: Node[], minDist = 11): Node[] {
  const result = input.map((n) => ({ ...n }));
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i], b = result[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        if (dist < minDist) {
          const push = (minDist - dist) / 2;
          const ux = dx / dist, uy = dy / dist;
          a.x = Math.min(96, Math.max(4, a.x - ux * push));
          a.y = Math.min(96, Math.max(4, a.y - uy * push));
          b.x = Math.min(96, Math.max(4, b.x + ux * push));
          b.y = Math.min(96, Math.max(4, b.y + uy * push));
        }
      }
    }
  }
  return result;
}

type Mode = "search" | "ask";

const modeCopy: Record<Mode, { eyebrow: string; heading: [string, string]; body: [string, string] }> = {
  search: {
    eyebrow: "hybrid search",
    heading: ["find the", "paper"],
    body: [
      "semantic similarity combined with structured filters — category, date — reranked with a cross-encoder before results reach you.",
      "search returns the actual papers, not a synthesized answer. use ask instead if you want a direct response grounded in what's retrieved.",
    ],
  },
  ask: {
    eyebrow: "retrieval augmented",
    heading: ["talk to the", "corpus"],
    body: [
      "every answer is grounded in retrieved paper text, reranked for relevance, and cited back to the paper and section it came from.",
      "ask something specific about the indexed papers, or start with one of the example questions in the chat.",
    ],
  },
};

function ModeToggle({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const options: { key: Mode; label: string }[] = [
    { key: "search", label: "search" },
    { key: "ask", label: "ask" },
  ];
  return (
    <div className="inline-flex items-center gap-1 bg-accent-soft/10 border border-accent-soft/40 rounded-full p-1">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => setMode(o.key)}
          className="relative px-6 py-2 text-sm rounded-full"
        >
          {mode === o.key && (
            <motion.div
              layoutId="modeToggleBg"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
              className="absolute inset-0 bg-accent rounded-full"
            />
          )}
          <span className={`relative z-10 transition-colors ${mode === o.key ? "text-accent-fg" : "text-fg/60 hover:text-fg"}`}>
            {o.label}
          </span>
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const shouldReduceMotion = useReducedMotion();
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });
  const [mode, setMode] = useState<Mode>("search");

  useEffect(() => {
    const el = graphRef.current;
    if (!el) return;
    const updateDims = () => setDims({ width: el.clientWidth, height: el.clientHeight });
    updateDims();
    const raf = requestAnimationFrame(updateDims);
    window.addEventListener("resize", updateDims);
    const observer = new ResizeObserver(updateDims);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updateDims);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (shouldReduceMotion) return;
    const interval = setInterval(() => {
      setNodes((prev) =>
        resolveOverlap(
          prev.map((n) => ({
            ...n,
            x: Math.min(96, Math.max(4, n.x + (Math.random() - 0.5) * 30)),
            y: Math.min(96, Math.max(4, n.y + (Math.random() - 0.5) * 30)),
          }))
        )
      );
    }, REST_MS + MOVE_MS);
    return () => clearInterval(interval);
  }, [shouldReduceMotion]);

  const nodeMap = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: shouldReduceMotion ? 0 : 0.12 } },
  };

  const item = {
    hidden: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
    },
  };

  const goToSearch = () => {
    setMode("search");
    document.getElementById("explore")?.scrollIntoView({ behavior: "smooth" });
  };

  const activeCopy = modeCopy[mode];

  return (
    <div className="relative overflow-hidden">
      <motion.div
        className="pointer-events-none absolute top-[10vh] right-0 w-[600px] h-[600px] bg-accent/10 blur-[130px] rounded-full"
        animate={shouldReduceMotion ? {} : { x: [0, 30, -10, 0], y: [0, -20, 15, 0], scale: [1, 1.08, 0.96, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute top-[85vh] left-1/4 w-[500px] h-[500px] bg-accent-soft/10 blur-[120px] rounded-full"
        animate={shouldReduceMotion ? {} : { x: [0, -20, 15, 0], y: [0, 15, -10, 0], scale: [1, 0.95, 1.05, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />

      <main ref={graphRef} className="relative min-h-[calc(100vh-4rem)] flex items-center px-6 sm:px-10 md:px-16 lg:px-24 py-24 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          {dims.width > 0 &&
            edgePool.map(([from, to], i) => {
              const p1 = nodeMap[from];
              const p2 = nodeMap[to];
              if (!p1 || !p2) return null;
              const x1 = (p1.x / 100) * dims.width;
              const y1 = (p1.y / 100) * dims.height;
              const x2 = (p2.x / 100) * dims.width;
              const y2 = (p2.y / 100) * dims.height;
              const dx = x2 - x1;
              const dy = y2 - y1;
              const length = Math.hypot(dx, dy);
              const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
              const cycle = (REST_MS + MOVE_MS) / 1000;

              return (
                <div
                  key={`${from}-${to}`}
                  className="absolute origin-left text-accent dark:text-accent-soft"
                  style={{
                    left: x1,
                    top: y1,
                    width: length,
                    height: 1,
                    transform: `rotate(${angle}deg)`,
                    transition: shouldReduceMotion
                      ? "none"
                      : `left ${MOVE_MS}ms ease-in-out, top ${MOVE_MS}ms ease-in-out, width ${MOVE_MS}ms ease-in-out, transform ${MOVE_MS}ms ease-in-out`,
                  }}
                >
                  <div
                    className="w-full h-full"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(to right, currentColor 0px 5px, transparent 5px 11px)",
                      opacity: shouldReduceMotion ? 0.18 : 0,
                      animation: shouldReduceMotion
                        ? "none"
                        : `dash-crawl 2.4s linear infinite, line-fade ${cycle}s ease-in-out ${i * 0.45}s infinite`,
                    }}
                  />
                </div>
              );
            })}
        </div>

        <div className="pointer-events-none absolute inset-0">
          {dims.width > 0 &&
            nodes.map((n, i) => {
              const flipUp = n.y > 65;
              const anchorLeft = n.x < 12;
              const anchorRight = n.x > 88;
              const isHovered = hoveredNode === n.id;
              const px = (n.x / 100) * dims.width;
              const py = (n.y / 100) * dims.height;
              return (
                <div
                  key={n.id}
                  className="absolute pointer-events-auto"
                  style={{
                    left: 0,
                    top: 0,
                    transform: `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%)`,
                    transition: shouldReduceMotion ? "none" : `transform ${MOVE_MS}ms ease-in-out`,
                    zIndex: isHovered ? 50 : 1,
                  }}
                  onMouseEnter={() => setHoveredNode(n.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  <motion.div
                    className="w-2 h-2 rounded-full bg-current text-accent dark:text-accent-soft"
                    style={{ opacity: isHovered ? 0.9 : 0.35 }}
                    animate={shouldReduceMotion ? {} : { opacity: [0.25, 0.6, 0.25] }}
                    transition={{ duration: 2.5 + (i % 3), repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
                  />
                  <div className="absolute inset-0 -m-2.5" style={{ cursor: "pointer" }} />
                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: flipUp ? 4 : -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: flipUp ? 4 : -4 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute w-52 rounded-md border border-accent-soft bg-bg shadow-xl px-3 py-2.5 z-50 ${
                          flipUp ? "bottom-full mb-2" : "top-full mt-2"
                        } ${anchorLeft ? "left-0" : anchorRight ? "right-0" : "left-1/2 -translate-x-1/2"}`}
                      >
                        <p className="text-[12px] font-heading text-extrabold text-fg leading-snug mb-0.5">{paperInfo[n.id].title}</p>
                        <p className="text-[11px] font-heading italic text-accent dark:text-accent-soft mb-1">{paperInfo[n.id].authors}</p>
                        <p className="text-[10px] text-fg/60 leading-snug">{paperInfo[n.id].blurb}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
        </div>

        <div className="relative w-full grid lg:grid-cols-2 gap-16 items-center">
          <motion.div variants={container} initial="hidden" animate="show" className="max-w-2xl">
            <motion.span
              variants={item}
              className="inline-block text-base uppercase tracking-wider text-accent dark:text-accent-soft bg-accent-soft/20 dark:bg-accent-soft/10 border border-accent-soft/60 rounded-full px-2.5 py-0.5 mb-6"
            >
              cs.ai · updated daily
            </motion.span>

            <motion.h1 variants={item} className="mb-6">
              <span className="block font-heading font-extralight italic text-2xl sm:text-3xl md:text-4xl text-fg/50 tracking-tight mb-1">
                search past
              </span>
              <span className="block leading-[1.05] tracking-tighter text-5xl sm:text-6xl md:text-7xl lg:text-8xl">
                <span className="text-tighter font-heading font-normal italic">the </span>
                <span className="font-body font-semibold text-accent dark:text-accent-soft">abstract</span>
              </span>
            </motion.h1>

            <motion.div variants={item} className="max-w-2xl mb-10">
              <p className="text-lg sm:text-xl text-fg/70 leading-relaxed">
                built on retrieval-augmented generation (RAG) over full paper text.
                <br />
                ask a question and get an answer pulled from the actual paper, with the
                section it came from.
              </p>
              <p className="text-sm sm:text-base text-fg/50 leading-relaxed mt-3">
                search combines semantic similarity with structured filters like
                category and date, then reranks results with a cross-encoder before
                anything reaches the model. the corpus updates daily from arxiv,
                chunked by section rather than left as raw pages.
              </p>
            </motion.div>

            <motion.button
              variants={item}
              onClick={goToSearch}
              whileHover={
                shouldReduceMotion
                  ? undefined
                  : { scale: 1.04, boxShadow: "0 0 28px var(--color-accent)", transition: { duration: 0.25 } }
              }
              whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
              className="group bg-accent text-accent-fg font-medium px-8 py-4 rounded-full text-base sm:text-lg transition-colors hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent inline-flex items-center gap-2"
            >
              start searching
              <ArrowRight size={17} strokeWidth={2.5} className="transition-transform duration-300 group-hover:translate-x-1" />
            </motion.button>
          </motion.div>

          <div className="hidden lg:block relative h-[440px]">
            {previewChunks.map((chunk, i) => (
              <div key={chunk.section} className="absolute" style={{ top: `${i * 30}%`, left: `${i % 2 === 0 ? 10 : 35}%` }}>
                <div
                  className={shouldReduceMotion ? "" : "animate-[float_5s_ease-in-out_infinite]"}
                  style={{ animationDelay: `${i * 0.4}s` }}
                >
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.4 + i * 0.15 }}
                    whileHover={shouldReduceMotion ? undefined : { scale: 1.05, transition: { duration: 0.2 } }}
                    className="w-96 font-heading rounded-lg border border-accent-soft bg-bg shadow-lg p-6 cursor-default hover:border-accent transition-colors"
                  >
                    <span className="inline-block text-sm italic tracking-wide text-accent-fg bg-accent rounded px-2 py-0.5 mb-2">
                      {chunk.section}
                    </span>
                    <p className="font-body text-sm text-fg/70 leading-relaxed">{chunk.snippet}</p>
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <section id="explore" className="relative px-6 sm:px-10 md:px-16 lg:px-24 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-center mb-10">
            <ModeToggle mode={mode} setMode={setMode} />
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1">
              <AnimatePresence mode="wait">
                {mode === "search" ? (
                  <motion.div
                    key="search"
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12, scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  >
                    <SearchPanel />
                  </motion.div>
                ) : (
                  <motion.div
                    key="ask"
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12, scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  >
                    <AskChat />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="order-1 lg:order-2">
              <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  <span className="inline-block text-xs sm:text-sm tracking-[0.15em] uppercase text-accent dark:text-accent-soft bg-accent-soft/20 dark:bg-accent-soft/10 border border-accent-soft/60 rounded-full px-2.5 py-0.5 mb-6">
                    {activeCopy.eyebrow}
                  </span>
                  <h2 className="mb-6 leading-[1.05] tracking-tight text-4xl sm:text-5xl">
                    <span className="font-heading font-normal">{activeCopy.heading[0]} </span>
                    <span className="font-heading italic text-accent dark:text-accent-soft">{activeCopy.heading[1]}</span>
                  </h2>
                  <p className="text-base sm:text-lg text-fg/70 leading-relaxed mb-3">{activeCopy.body[0]}</p>
                  <p className="text-sm sm:text-base text-fg/50 leading-relaxed">{activeCopy.body[1]}</p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}