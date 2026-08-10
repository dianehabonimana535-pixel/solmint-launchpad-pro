"use client";

import { useMemo, useRef, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { PublicKey } from "@solana/web3.js";
import { Upload, Copy, ExternalLink, RefreshCw, CheckCircle2, Droplets, X as XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import TokenPreviewCard from "@/components/TokenPreviewCard";
import AuthorityOptions, { Authorities } from "@/components/AuthorityOptions";
import ProgressSteps, { MINT_STEPS } from "@/components/ProgressSteps";
import FeeEstimator from "@/components/FeeEstimator";
import { uploadTokenAssets } from "@/lib/ipfs";
import { createToken, MintStep } from "@/lib/mint";
import { addHistoryEntry } from "@/lib/history";
import { solscanAddressUrl, solscanTxUrl, raydiumCreatePoolUrl, NETWORK_LABEL, buildShareOnXUrl } from "@/lib/network";
import { estimateFees } from "@/lib/fees";
import { shortenAddress, cn } from "@/lib/utils";

interface FormState {
  name: string;
  symbol: string;
  description: string;
  decimals: string;
  supply: string;
  website: string;
  twitter: string;
  telegram: string;
  discord: string;
  recipient: string;
  creatorAddress: string;
  creatorName: string;
}

const initialForm: FormState = {
  name: "",
  symbol: "",
  description: "",
  decimals: "9",
  supply: "1000000000",
  website: "",
  twitter: "",
  telegram: "",
  discord: "",
  recipient: "",
  creatorAddress: "",
  creatorName: "",
};

const STEP_INDEX: Record<MintStep | "wallet" | "logo" | "metadata", number> = {
  wallet: 0,
  logo: 1,
  metadata: 2,
  building: 3,
  "creating-mint": 3,
  "minting-supply": 4,
  "revoking-authorities": 5,
  confirming: 6,
  complete: 6,
};

type Phase = "idle" | "running" | "success" | "error";

export default function TokenCreatorForm() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(initialForm);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);
  const [authorities, setAuthorities] = useState<Authorities>({
    revokeMint: true,
    revokeFreeze: true,
    revokeUpdate: true,
  });
  const [customCreatorEnabled, setCustomCreatorEnabled] = useState(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [failedIndex, setFailedIndex] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<{ mintAddress: string; signature: string } | null>(null);

  const revokeCount =
    (authorities.revokeMint ? 1 : 0) +
    (authorities.revokeFreeze ? 1 : 0) +
    (authorities.revokeUpdate ? 1 : 0);
  const revokingAny = revokeCount > 0;
  const totalFeeSol = estimateFees(revokeCount).totalSol;

  const errors = useMemo(
    () => validate(form, logoFile, wallet.connected, customCreatorEnabled),
    [form, logoFile, wallet.connected, customCreatorEnabled]
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleFile(file: File | null) {
    if (!file) {
      setLogoFile(null);
      setLogoPreviewUrl(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Logo must be an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be smaller than 5MB");
      return;
    }
    setLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
  }

  function handleBannerFile(file: File | null) {
    if (!file) {
      setBannerFile(null);
      setBannerPreviewUrl(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Banner must be an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Banner must be smaller than 5MB");
      return;
    }
    setBannerFile(file);
    setBannerPreviewUrl(URL.createObjectURL(file));
  }

  async function handleSubmit() {
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }
    if (!wallet.publicKey || !wallet.connected) {
      toast.error("Connect your wallet first");
      return;
    }

    setPhase("running");
    setFailedIndex(null);
    setErrorMessage(null);
    setCurrentIndex(0);

    const creatorAddress = customCreatorEnabled ? form.creatorAddress.trim() : "";
    const creatorName = customCreatorEnabled ? form.creatorName.trim() : "";

    try {
      setCurrentIndex(STEP_INDEX.logo);
      const { metadataUri } = await uploadTokenAssets(
        logoFile as File,
        {
          name: form.name.trim(),
          symbol: form.symbol.trim().toUpperCase(),
          description: form.description.trim(),
          website: form.website.trim(),
          twitter: form.twitter.trim(),
          telegram: form.telegram.trim(),
          discord: form.discord.trim(),
          creatorAddress: creatorAddress || undefined,
          creatorName: creatorName || undefined,
        },
        bannerFile
      );
      setCurrentIndex(STEP_INDEX.metadata);

      const recipient = form.recipient.trim() || wallet.publicKey.toBase58();

      const mintResult = await createToken({
        wallet,
        connection,
        name: form.name.trim(),
        symbol: form.symbol.trim().toUpperCase(),
        decimals: Number(form.decimals),
        supply: Number(form.supply),
        metadataUri,
        recipient,
        revokeMint: authorities.revokeMint,
        revokeFreeze: authorities.revokeFreeze,
        revokeUpdate: authorities.revokeUpdate,
        creatorAddress: creatorAddress || undefined,
        onStep: (step) => setCurrentIndex(STEP_INDEX[step]),
      });

      setResult(mintResult);
      setPhase("success");
      setCurrentIndex(MINT_STEPS.length);

      addHistoryEntry({
        name: form.name.trim(),
        symbol: form.symbol.trim().toUpperCase(),
        mintAddress: mintResult.mintAddress,
        signature: mintResult.signature,
        createdAt: new Date().toISOString(),
        revokedCount: revokeCount,
      });

      toast.success(`Token created on Solana ${NETWORK_LABEL}!`);
    } catch (err: any) {
      console.error(err);
      setFailedIndex(currentIndex);
      setPhase("error");
      const message = err?.message || "Something went wrong while creating your token";
      setErrorMessage(message);
      toast.error(message);
    }
  }

  function reset() {
    setForm(initialForm);
    setLogoFile(null);
    setLogoPreviewUrl(null);
    setBannerFile(null);
    setBannerPreviewUrl(null);
    setCustomCreatorEnabled(false);
    setPhase("idle");
    setCurrentIndex(-1);
    setFailedIndex(null);
    setErrorMessage(null);
    setResult(null);
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }

  if (phase === "success" && result) {
    return (
      <div className="mx-auto max-w-xl">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 pt-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/20">
              <CheckCircle2 className="h-9 w-9 text-accent" />
            </div>
            <h2 className="font-display text-2xl font-bold">Your token is live</h2>
            <p className="text-sm text-muted-foreground">
              {form.name} (${form.symbol}) has been minted on Solana {NETWORK_LABEL}.
            </p>

            <div className="w-full space-y-2 rounded-xl border border-border bg-secondary/30 p-4 text-left">
              <Row label="Token address" value={shortenAddress(result.mintAddress, 6)} onCopy={() => copy(result.mintAddress, "Token address")} />
              <Row label="Transaction" value={shortenAddress(result.signature, 6)} onCopy={() => copy(result.signature, "Signature")} />
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline" className="flex-1">
                <a href={solscanAddressUrl(result.mintAddress)} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> View Token on Solscan
                </a>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <a href={solscanTxUrl(result.signature)} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> View Transaction
                </a>
              </Button>
            </div>

            <Button asChild variant="outline" className="w-full">
              <a href={raydiumCreatePoolUrl(result.mintAddress)} target="_blank" rel="noreferrer">
                <Droplets className="h-4 w-4" /> Create Liquidity Pool
              </a>
            </Button>

            <Button asChild variant="outline" className="w-full">
              <a
                href={buildShareOnXUrl(form.name, form.symbol, result.mintAddress, revokeCount)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <XIcon className="h-4 w-4" /> Share on X
              </a>
            </Button>

            <Button variant="gradient" className="w-full" onClick={reset}>
              Create another token
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Token details</CardTitle>
            <CardDescription>The basics that will live permanently on-chain.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Token name" required>
                <Input placeholder="e.g. Solar Doge" value={form.name} onChange={(e) => update("name", e.target.value)} maxLength={32} />
              </Field>
              <Field label="Symbol" required>
                <Input placeholder="e.g. SDOGE" value={form.symbol} onChange={(e) => update("symbol", e.target.value.toUpperCase())} maxLength={10} />
              </Field>
            </div>

            <Field label="Description" required>
              <Textarea
                placeholder="What is your token about?"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                maxLength={500}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
