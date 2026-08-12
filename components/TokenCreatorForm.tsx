"use client";

import { useMemo, useRef, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { PublicKey } from "@solana/web3.js";
import { Upload, Copy, ExternalLink, RefreshCw, Droplets, X as XIcon, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import TokenPreviewCard from "@/components/TokenPreviewCard";
import AuthorityOptions, { Authorities } from "@/components/AuthorityOptions";
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

type Phase = "idle" | "running" | "success" | "error";

// The labels shown in the custom progress popup. These map onto the real,
// distinct async boundaries reported by lib/mint.ts's onStep callback
// (signed -> sent -> confirmed -> complete). Nothing here is faked with
// setTimeout: each transition is driven by a genuine event from the mint
// flow. See handleSubmit's onStep handler below for the exact mapping.
const FLOW_MESSAGES = [
  "Confirming transaction",
  "Transaction received",
  "Creating token",
  "Token created",
  "Token sent to owner's wallet",
  "Complete",
];

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<{ mintAddress: string; signature: string } | null>(null);

  // Whether the custom progress popup is currently visible. This only ever
  // becomes true once lib/mint.ts reports the "signed" step, i.e. once
  // Phantom (or whichever wallet is connected) has actually returned a
  // signature. It is never shown before that, and never shown at all if
  // the user rejects the wallet prompt.
  const [showModal, setShowModal] = useState(false);
  const [flowStep, setFlowStep] = useState(0);
  const flowStepRef = useRef(0);

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

  // Steps forward through FLOW_MESSAGES one at a time (not jumping straight
  // to the target), so the user actually sees each message appear in
  // sequence. This only ever runs after a real event has already happened
  // (signed / sent / confirmed) -- it paces how those already-true facts
  // are revealed, it does not simulate work that hasn't happened yet.
  function animateFlowTo(target: number, onDone?: () => void) {
    const tick = () => {
      if (flowStepRef.current >= target) {
        onDone?.();
        return;
      }
      flowStepRef.current += 1;
      setFlowStep(flowStepRef.current);
      setTimeout(tick, 550);
    };
    tick();
  }

  function onMintStep(step: MintStep) {
    // "building" and "awaiting-signature" happen before the wallet has
    // returned anything - the custom popup stays hidden during these.
    // The button shows a spinner + "Waiting for wallet approval..." and
    // the wallet's own extension shows its native approval popup here.
    if (step === "signed") {
      // Phantom (or the connected wallet) has just returned a valid
      // signature. This is the exact, real moment to reveal our popup.
      flowStepRef.current = 0;
      setFlowStep(0); // "Confirming transaction"
      setShowModal(true);
    } else if (step === "sent") {
      // The signed transaction was successfully broadcast to the network.
      animateFlowTo(2); // reveals "Transaction received" then "Creating token"
    } else if (step === "confirmed") {
      // The transaction is finalized on-chain: the token now exists and
      // the supply has been sent to the recipient wallet, atomically, in
      // the same transaction. Reveal the remaining messages in sequence,
      // then hand off to the success screen once "Complete" has been shown.
      animateFlowTo(5, () => {
        setTimeout(() => setPhase("success"), 700);
      });
    }
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
    setErrorMessage(null);
    setShowModal(false);
    setFlowStep(0);

    const creatorAddress = customCreatorEnabled ? form.creatorAddress.trim() : "";
    const creatorName = customCreatorEnabled ? form.creatorName.trim() : "";

    try {
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
        onStep: onMintStep,
      });

      setResult(mintResult);

      addHistoryEntry({
        name: form.name.trim(),
        symbol: form.symbol.trim().toUpperCase(),
        mintAddress: mintResult.mintAddress,
        signature: mintResult.signature,
        createdAt: new Date().toISOString(),
        revokedCount: revokeCount,
      });

      // The switch to the success screen is now triggered from inside
      // onMintStep, once the "Complete" message has actually been shown
      // to the user (see animateFlowTo's onDone callback above).
    } catch (err: any) {
      console.error(err);
      setPhase("error");
      setShowModal(false);
      const rejected =
        typeof err?.message === "string" &&
        /reject|declin|cancel/i.test(err.message);
      const message = rejected
        ? "Transaction was cancelled in your wallet."
        : err?.message || "Something went wrong while creating your token";
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
    setShowModal(false);
    setFlowStep(0);
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
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/20 text-2xl font-bold text-accent">
              OK
            </div>
            <h2 className="font-display text-3xl font-bold gradient-text">Congratulations!</h2>
            <p className="text-sm text-muted-foreground">
              {form.name} (${form.symbol}) has been successfully created and deployed
              on the Solana blockchain.
            </p>

            <div className="w-full space-y-1.5 rounded-xl border border-border bg-secondary/30 p-4 text-left">
              <span className="text-xs text-muted-foreground">Token Address</span>
              <div className="flex items-center justify-between gap-2 font-mono text-sm text-accent">
                <span className="truncate">{result.mintAddress}</span>
              </div>
            </div>

            <Button
              variant="gradient"
              className="w-full"
              onClick={() => copy(result.mintAddress, "Token address")}
            >
              <Copy className="h-4 w-4" /> Copy Token Address
            </Button>

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

  const percent = Math.round((flowStep / (FLOW_MESSAGES.length - 1)) * 100);

  return (
    <>
      {showModal && phase === "running" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-base font-bold text-foreground">
                {FLOW_MESSAGES[flowStep]}...
              </p>
              <span className="font-mono text-base font-semibold text-accent">
                {percent}%
              </span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/60">
              <div
                className="h-full rounded-full animated-gradient transition-all duration-500 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>

            <div className="mt-4 space-y-1.5 text-sm">
              {FLOW_MESSAGES.map((label, i) =>
                i < flowStep ? (
                  <p key={label} className="text-accent">
                    {label} - done
                  </p>
                ) : null
              )}
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Please keep this window open until the transaction is finalized.
            </p>
          </div>
        </div>
      )}

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
                <Field label="Decimals" required hint="9 is the Solana standard for meme coins">
                  <Input type="number" min={0} max={9} value={form.decimals} onChange={(e) => update("decimals", e.target.value)} />
                </Field>
                <Field label="Initial supply" required>
                  <Input type="number" min={1} value={form.supply} onChange={(e) => update("supply", e.target.value)} />
                </Field>
              </div>

              <Field label="Logo" required>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/20 px-4 py-8 text-center transition-colors hover:border-primary/60"
                >
                  {logoPreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreviewUrl} alt="Logo preview" className="h-16 w-16 rounded-lg object-cover" />
                  ) : (
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  )}
                  <p className="text-xs text-muted-foreground">
                    {logoFile ? logoFile.name : "PNG or JPG, square, up to 5MB"}
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] || null)}
                />
              </Field>

              <Field
                label={
                  <span className="flex items-center gap-2">
                    Banner (Optional)
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-medium text-emerald-400">
                      FREE
                    </span>
                  </span>
                }
                hint="Wide image shown on DEX Screener and similar sites, e.g. 1500x500px"
              >
                <div
                  onClick={() => bannerInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/20 px-4 py-6 text-center transition-colors hover:border-primary/60"
                >
                  {bannerPreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={bannerPreviewUrl} alt="Banner preview" className="h-16 w-full rounded-lg object-cover" />
                  ) : (
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  )}
                  <p className="text-xs text-muted-foreground">
                    {bannerFile ? bannerFile.name : "PNG or JPG, wide format, up to 5MB"}
                  </p>
                </div>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleBannerFile(e.target.files?.[0] || null)}
                />
              </Field>

              <Field label="Recipient wallet" hint="Defaults to your connected wallet if left blank">
                <Input
                  placeholder={wallet.publicKey?.toBase58() || "Connect wallet for default"}
                  value={form.recipient}
                  onChange={(e) => update("recipient", e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="customCreator"
                    checked={customCreatorEnabled}
                    onCheckedChange={(v) => setCustomCreatorEnabled(Boolean(v))}
                    className="mt-1"
                  />
                  <div>
                    <Label htmlFor="customCreator" className="flex items-center gap-2 text-base font-semibold">
                      Creator's Info (Optional)
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-medium text-emerald-400">
                        FREE
                      </span>
                    </Label>
                    <CardDescription className="mt-1">
                      Change the information of the creator in the metadata. By default, it's
                      your connected wallet.
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            {customCreatorEnabled && (
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Creator's Address" required hint="Won't be marked verified - it hasn't signed this transaction">
                  <Input
                    placeholder="Ex: 3stNIYCJd..."
                    value={form.creatorAddress}
                    onChange={(e) => update("creatorAddress", e.target.value)}
                  />
                </Field>
                <Field label="Creator's Name" required>
                  <Input
                    placeholder="Ex: John Doe"
                    value={form.creatorName}
                    onChange={(e) => update("creatorName", e.target.value)}
                    maxLength={64}
                  />
                </Field>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Social links
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-medium text-emerald-400">
                  FREE
                </span>
              </CardTitle>
              <CardDescription>Optional - shown in your token metadata.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Website"><Input placeholder="https://..." value={form.website} onChange={(e) => update("website", e.target.value)} /></Field>
              <Field label="Twitter / X"><Input placeholder="https://x.com/..." value={form.twitter} onChange={(e) => update("twitter", e.target.value)} /></Field>
              <Field label="Telegram"><Input placeholder="https://t.me/..." value={form.telegram} onChange={(e) => update("telegram", e.target.value)} /></Field>
              <Field label="Discord"><Input placeholder="https://discord.gg/..." value={form.discord} onChange={(e) => update("discord", e.target.value)} /></Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Token authorities</CardTitle>
              <CardDescription>Choose what to permanently give up for holder trust.</CardDescription>
            </CardHeader>
            <CardContent>
              <AuthorityOptions value={authorities} onChange={setAuthorities} />
            </CardContent>
          </Card>

          {phase === "error" && (
            <Card className="border-destructive/40">
              <CardContent className="flex flex-col gap-4 pt-6">
                <p className="text-sm text-destructive">{errorMessage}</p>
                <Button variant="outline" onClick={handleSubmit}>
                  <RefreshCw className="h-4 w-4" /> Retry
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-4 py-3">
            <span className="text-sm text-muted-foreground">Total fees to create this token</span>
            <span className="font-mono text-base font-semibold gradient-text">{totalFeeSol.toFixed(4)} SOL</span>
          </div>

          <p className="text-xs text-muted-foreground">
            Note: Your wallet will be charged the creation amount shown above (
            <span className="font-mono font-semibold text-red-500">-{totalFeeSol.toFixed(4)} SOL</span>
            ), plus Solana network transaction fees. Your wallet&apos;s confirmation popup may only display
            the network fee - the total amount charged will still match what&apos;s shown here.
          </p>

          <Button
            size="lg"
            variant="gradient"
            className="w-full"
            disabled={phase === "running" || !wallet.connected}
            onClick={handleSubmit}
          >
            {phase === "running" && <Loader2 className="h-4 w-4 animate-spin" />}
            {!wallet.connected
              ? "Connect wallet to continue"
              : phase !== "running"
              ? `Create token on ${NETWORK_LABEL}`
              : showModal
              ? "Creating token..."
              : "Waiting for wallet approval..."}
          </Button>
          {errors.length > 0 && wallet.connected && (
            <p className="text-center text-xs text-muted-foreground">{errors[0]}</p>
          )}
        </div>

        <div className="space-y-6">
          <TokenPreviewCard
            name={form.name}
            symbol={form.symbol}
            description={form.description}
            logoPreviewUrl={logoPreviewUrl}
            supply={form.supply}
            decimals={form.decimals}
            website={form.website}
            twitter={form.twitter}
            telegram={form.telegram}
            discord={form.discord}
          />
          <FeeEstimator authoritiesToRevokeCount={revokeCount} />
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: React.ReactNode;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function validate(
  form: FormState,
  logoFile: File | null,
  connected: boolean,
  customCreatorEnabled: boolean
): string[] {
  const errors: string[] = [];
  if (!form.name.trim()) errors.push("Token name is required");
  if (form.name.length > 32) errors.push("Token name must be 32 characters or fewer");
  if (!form.symbol.trim()) errors.push("Symbol is required");
  if (form.symbol.length > 10) errors.push("Symbol must be 10 characters or fewer");
  if (!form.description.trim()) errors.push("Description is required");
  if (!logoFile) errors.push("Logo image is required");

  const decimals = Number(form.decimals);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 9) {
    errors.push("Decimals must be a whole number between 0 and 9");
  }

  const supply = Number(form.supply);
  if (!Number.isFinite(supply) || supply <= 0) {
    errors.push("Initial supply must be greater than 0");
  }

  if (form.recipient.trim()) {
    try {
      // eslint-disable-next-line no-new
      new PublicKey(form.recipient.trim());
    } catch {
      errors.push("Recipient wallet address is not a valid Solana address");
    }
  }

  if (customCreatorEnabled) {
    if (!form.creatorAddress.trim()) {
      errors.push("Creator's address is required when Creator's Info is enabled");
    } else {
      try {
        // eslint-disable-next-line no-new
        new PublicKey(form.creatorAddress.trim());
      } catch {
        errors.push("Creator's address is not a valid Solana address");
      }
    }
    if (!form.creatorName.trim()) {
      errors.push("Creator's name is required when Creator's Info is enabled");
    }
  }

  for (const [label, url] of [
    ["Website", form.website],
    ["Twitter", form.twitter],
    ["Telegram", form.telegram],
    ["Discord", form.discord],
  ] as const) {
    if (url && !/^https?:\/\//i.test(url)) {
      errors.push(`${label} link must start with http:// or https://`);
    }
  }

  return errors;
}
