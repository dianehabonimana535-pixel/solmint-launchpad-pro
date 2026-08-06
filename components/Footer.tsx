import Link from "next/link";
import { Coins } from "lucide-react";
import { SOLANA_NETWORK } from "@/lib/network";

export default function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="container flex flex-col items-center justify-between gap-4 py-10 sm:flex-row">
        <div className="flex items-center gap-2 font-display text-sm font-semibold">
          <Coins className="h-4 w-4 text-accent" />
          SolMint Launchpad
        </div>
        <p className="text-center text-xs text-muted-foreground sm:text-left">
          Non-custodial. Flat 0.2 SOL platform fee. Built for Solana {SOLANA_NETWORK}. Not
          financial advice — creating a token carries risk; do your own research.
        </p>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <Link href="/create" className="hover:text-foreground">Create</Link>
          <Link href="/history" className="hover:text-foreground">History</Link>
          <a href="https://explorer.solana.com" target="_blank" rel="noreferrer" className="hover:text-foreground">
            Explorer
          </a>
        </div>
      </div>
    </footer>
  );
}
