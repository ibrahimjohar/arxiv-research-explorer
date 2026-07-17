"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const previewChunks = [
  { section: "introduction", snippet: "we propose a dual-attention framework for..." },
  { section: "method", snippet: "the policy is trained with proximal policy optimization..." },
  { section: "results", snippet: "this reduces error by a wide margin across all..." },
];

// original bold geometric arrow: solid shapes, sharp angles — same spirit as
// the reference, not a reproduction of it
function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} className={className} fill="currentColor" aria-hidden="true">
      <polygon points="2,4 14,4 14,0 24,12 14,24 14,20 2,20" />
    </svg>
  );
}

const nodes = [
  { id: "a", x: 80, y: 550 }, { id: "b", x: 220, y: 480 }, { id: "c", x: 150, y: 650 },
  { id: "d", x: 420, y: 620 }, { id: "e", x: 620, y: 100 }, { id: "f", x: 760, y: 220 },
  { id: "g", x: 880, y: 340 }, { id: "h", x: 700, y: 480 }, { id: "i", x: 900, y: 600 },
  { id: "j", x: 500, y: 60 }, { id: "k", x: 350, y: 220 },
];
const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
const edges: [string, string][] = [
  ["a", "b"], ["b", "c"], ["b", "d"], ["d", "h"], ["e", "f"],
  ["f", "g"], ["g", "h"], ["g", "i"], ["e", "j"], ["k", "j"], ["k", "b"], ["h", "i"],
];
const pulseNodes = new Set(["a", "d", "e", "g", "i", "k"]);

const paperInfo: Record<string, { title: string; blurb: string }> = {
  a: { title: "Attention Is All You Need", blurb: "introduced the transformer architecture" },
  b: { title: "Deep Residual Learning for Image Recognition", blurb: "residual connections that enabled much deeper networks" },
  c: { title: "Generative Adversarial Networks", blurb: "two networks trained against each other to generate realistic data" },
  d: { title: "Playing Atari with Deep Reinforcement Learning", blurb: "deep q-networks learning to play games from raw pixels" },
  e: { title: "BERT: Pre-training of Deep Bidirectional Transformers", blurb: "bidirectional pretraining for language understanding" },
  f: { title: "Adam: A Method for Stochastic Optimization", blurb: "the optimizer most modern models train with" },
  g: { title: "Denoising Diffusion Probabilistic Models", blurb: "the generative process behind modern image diffusion" },
  h: { title: "Proximal Policy Optimization Algorithms", blurb: "a stable, widely used policy-gradient method" },
  i: { title: "ImageNet Classification with Deep Convolutional Neural Networks", blurb: "the result that kicked off the deep learning era in vision" },
  j: { title: "Sequence to Sequence Learning with Neural Networks", blurb: "mapping sequences to sequences with recurrent encoders and decoders" },
  k: { title: "Auto-Encoding Variational Bayes", blurb: "the variational autoencoder framework" },
};

export default function Home() {
  const shouldReduceMotion = useReducedMotion();
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

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

  return (
    <main className="relative min-h-screen flex items-center px-6 sm:px-10 md:px-16 lg:px-24 py-24 overflow-hidden">
      <svg
        className="pointer-events-none absolute inset-0 w-full h-full text-accent dark:text-accent-soft"
        viewBox="0 0 1000 700"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <g stroke="currentColor" strokeWidth={1} fill="none">
          {edges.map(([from, to], i) => (
            <motion.line
              key={`${from}-${to}`}
              x1={nodeMap[from].x}
              y1={nodeMap[from].y}
              x2={nodeMap[to].x}
              y2={nodeMap[to].y}
              strokeOpacity={0.18}
              strokeDasharray="5 7"
              animate={shouldReduceMotion ? {} : { strokeDashoffset: [0, -48] }}
              transition={{
                duration: 3 + (i % 4),
                repeat: Infinity,
                ease: "linear",
                delay: i * 0.15,
              }}
            />
          ))}
        </g>
        {nodes.map((n, i) => (
          <motion.circle
            key={n.id}
            cx={n.x}
            cy={n.y}
            r={pulseNodes.has(n.id) ? 5 : 3}
            fill="currentColor"
            opacity={hoveredNode === n.id ? 0.9 : 0.35}
            animate={
              shouldReduceMotion || !pulseNodes.has(n.id)
                ? {}
                : { opacity: [0.25, 0.6, 0.25] }
            }
            transition={{ duration: 2.5 + (i % 3), repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
          />
        ))}
      </svg>

      <div className="pointer-events-none absolute inset-0 hidden md:block">
        {nodes.map((n) => (
          <div
            key={n.id}
            className="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 w-6 h-6"
            style={{ left: `${(n.x / 1000) * 100}%`, top: `${(n.y / 700) * 100}%` }}
            onMouseEnter={() => setHoveredNode(n.id)}
            onMouseLeave={() => setHoveredNode(null)}
          >
            <AnimatePresence>
              {hoveredNode === n.id && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-56 rounded-lg border border-accent-soft bg-bg shadow-lg p-3 z-10"
                >
                  <p className="text-xs font-medium text-fg mb-1">{paperInfo[n.id].title}</p>
                  <p className="text-[11px] text-fg/60 leading-snug">{paperInfo[n.id].blurb}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute top-1/4 right-0 w-1/2 h-1/2 bg-accent/10 blur-[110px] rounded-full" />

      <div className="relative w-full grid lg:grid-cols-2 gap-16 items-center">
        <motion.div variants={container} initial="hidden" animate="show" className="max-w-xl">
          <motion.span
            variants={item}
            className="inline-block text-[10px] sm:text-xs tracking-[0.15em] uppercase text-accent dark:text-accent-soft bg-accent-soft/20 dark:bg-accent-soft/10 border border-accent-soft/60 rounded-full px-2.5 py-0.5 mb-6"
          >
            cs.ai · updated daily
          </motion.span>

          <motion.h1 variants={item} className="mb-6">
            <span className="block font-heading font-extralight text-xl sm:text-2xl md:text-3xl text-fg/50 tracking-tight mb-1">
              search past
            </span>
            <span className="block leading-[1.05] tracking-tight text-5xl sm:text-6xl md:text-7xl lg:text-8xl">
              <span className="font-heading font-normal">the </span>
              <span className="font-body font-semibold text-accent dark:text-accent-soft">
                abstract
              </span>
            </span>
          </motion.h1>

          <motion.p
            variants={item}
            className="text-base sm:text-lg text-fg/70 max-w-xl mb-10 leading-relaxed"
          >
            built on retrieval-augmented generation over full paper text — ask
            a question and get an answer pulled from the actual paper, with
            the section it came from.
          </motion.p>

          <motion.button
            variants={item}
            whileHover={
              shouldReduceMotion
                ? undefined
                : {
                    scale: 1.04,
                    boxShadow: "0 0 28px var(--color-accent)",
                    transition: { duration: 0.25 },
                  }
            }
            whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
            className="group bg-accent text-accent-fg font-medium px-6 py-3 rounded-full text-sm sm:text-base transition-colors hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent inline-flex items-center gap-2"
          >
            start searching
            <ArrowIcon className="transition-all duration-300 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100" />
          </motion.button>
        </motion.div>

        <div className="hidden lg:block relative h-[440px]">
          {previewChunks.map((chunk, i) => (
            <div
              key={chunk.section}
              className="absolute"
              style={{ top: `${i * 30}%`, left: `${i % 2 === 0 ? 10 : 35}%` }}
            >
              {/* ambient bob: pure CSS, runs on the compositor, never conflicts with hover */}
              <div
                className={shouldReduceMotion ? "" : "animate-[float_5s_ease-in-out_infinite]"}
                style={{ animationDelay: `${i * 0.4}s` }}
              >
                {/* hover response: Framer, only property it owns is scale */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.4 + i * 0.15 }}
                  whileHover={
                    shouldReduceMotion ? undefined : { scale: 1.05, transition: { duration: 0.2 } }
                  }
                  className="w-72 rounded-lg border border-accent-soft bg-bg shadow-lg p-5 cursor-default hover:border-accent transition-colors"
                >
                  <span className="inline-block text-xs tracking-wide uppercase text-accent-fg bg-accent rounded px-2 py-0.5 mb-2">
                    {chunk.section}
                  </span>
                  <p className="text-sm text-fg/70 leading-relaxed">{chunk.snippet}</p>
                </motion.div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}