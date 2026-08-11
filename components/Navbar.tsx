"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { Coins, Moon, Sun, History, Droplets } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getHistory } from "@/lib/history";
import { raydiumCreatePoolUrl } from "@/lib/network";

const WalletMultiButtonDynamic = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

type NavLink = {
  href: string;
  label: string;
  external?: boolean;
};

const baseLinks: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/create", label: "Create Token" },
  { href: "/trending", label: "Trending" },
  { href: "#faq", label: "How it works" },
  { href: "/history", label: "History" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [isLight, setIsLight] = useState(false);
  const [liquidityHref, setLiquidityHref] = useState(
    "https://raydium.io/liquidity/"
  );

  useEffect(() => {
    const stored = window.localStorage.getItem("solmint.theme");
    const light = stored === "light";
    setIsLight(light);
    document.documentElement.classList.toggle("light", light);
    document.documentElement.classList.toggle("dark", !light);
  }, []);

  useEffect(() => {
    const history = getHistory();
    if (history.length > 0) {
      const lastToken = history[0];
      setLiquidityHref(raydiumCreatePoolUrl(lastToken.mintAddress));
    }
  }, [pathname]);

  function toggleTheme() {
    const next = !isLight;
    setIsLight(next);
    document.documentElement.classList.toggle("light", next);
    document.documentElement.classList.toggle("dark", !next);
    window.localStorage.setItem("solmint.theme", next ? "light" : "dark");
  }

  const links: NavLink[] = [
    ...baseLinks.slice(0, 2),
    { href: liquidityHref, label: "Create Liquidity Pool", external: true },
    ...baseLinks.slice(2),
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-lg">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-1.5 font-display text-sm font-bold">
          <span className="flex h-6 w-6 items-center justify-center rounded-md animated-gradient">
            <Coins className="h-3 w-3 text-white" />
          </span>
          SolMint
          <span className="gradient-text">Launchpad</span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                pathname === link.href && "bg-secondary text-foreground"
              )}
            >
              {link.label === "History" ? (
                <span className="flex items-center gap-1">
                  <History className="h-3 w-3" /> {link.label}
                </span>
              ) : link.label === "Create Liquidity Pool" ? (
                <span className="flex items-center gap-1">
                  <Droplets className="h-3 w-3" /> {link.label}
                </span>
              ) : (
                link.label
              )}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground"
          >
            {isLight ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          </button>
          <WalletMultiButtonDynamic className="!h-8 !rounded-md !bg-primary !text-xs !font-medium" />
        </div>
      </div>

      <nav className="flex flex-col gap-1 border-t border-border/60 px-4 py-2 md:hidden">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            target={link.external ? "_blank" : undefined}
            rel={link.external ? "noopener noreferrer" : undefined}
            className={cn(
              "block rounded-md px-2.5 py-1.5 text-xs text-muted-foreground",
              pathname === link.href && "bg-secondary text-foreground"
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
