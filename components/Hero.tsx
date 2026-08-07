"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Zap, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SOLANA_NETWORK } from "@/lib/network";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(120,80,255,0.2),transparent)]" />

      <div className="container relative flex flex-col items-center gap-8 pb-24 pt-20 text-center md:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-4 py-1.5 text-xs backdrop-blur"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          Live on Solana · Flat 0.2 SOL platform fee
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-7xl"
        >
          Launch your Solana token.
          <br />
          <span className="gradient-text">Take it to the moon.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-xl text-balance text-base text-muted-foreground sm:text-lg"
        >
          Create and deploy your Solana meme coin effortlessly in seconds — logo, metadata,
          and authorities included. One flat 0.2 SOL platform fee, plus whatever Solana
          itself charges.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <Button asChild size="lg" variant="gradient">
            <Link href="/create">
              Create your token <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3"
        >
          {[
            { icon: Ban, label: "One flat fee", desc: "0.2 SOL, no hidden costs" },
            { icon: ShieldCheck, label: "Non-custodial", desc: "We never see your keys" },
            { icon: Zap, label: "Mints in seconds", desc: `${SOLANA_NETWORK}, no queue` },
          ].map((f) => (
            <div key={f.label} className="glass flex flex-col items-center gap-1.5 rounded-xl px-4 py-5">
              <f.icon className="h-5 w-5 text-accent" />
              <p className="text-sm font-semibold">{f.label}</p>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
