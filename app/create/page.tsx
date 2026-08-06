import TokenCreatorForm from "@/components/TokenCreatorForm";
import Footer from "@/components/Footer";

export default function CreatePage() {
  return (
    <main>
      <div className="container py-12">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Create your token</h1>
          <p className="mt-2 text-muted-foreground">
            Fill in the details below. You'll approve a single signature in your wallet, covering
            Solana's network fees plus SolMint Launchpad's platform fee (0.2 SOL creation, +0.05
            SOL per authority revoked).
          </p>
        </div>
        <TokenCreatorForm />
      </div>
      <Footer />
    </main>
  );
}
