export interface TokenMetadataInput {
  name: string;
  symbol: string;
  description: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  creatorName?: string;
  creatorAddress?: string;
}

export async function uploadTokenAssets(
  logo: File,
  meta: TokenMetadataInput,
  banner?: File | null
): Promise<{ imageUri: string; bannerUri?: string; metadataUri: string }> {
  const form = new FormData();
  form.append("file", logo);
  form.append("kind", "image");

  const imageRes = await fetch("/api/upload", { method: "POST", body: form });
  if (!imageRes.ok) {
    const err = await safeJson(imageRes);
    throw new Error(err?.error || "Logo upload to IPFS failed");
  }
  const { uri: imageUri } = await imageRes.json();

  let bannerUri: string | undefined;
  if (banner) {
    const bannerForm = new FormData();
    bannerForm.append("file", banner);
    bannerForm.append("kind", "image");
    const bannerRes = await fetch("/api/upload", { method: "POST", body: bannerForm });
    if (!bannerRes.ok) {
      const err = await safeJson(bannerRes);
      throw new Error(err?.error || "Banner upload to IPFS failed");
    }
    bannerUri = (await bannerRes.json()).uri;
  }

  const metadataJson: Record<string, unknown> = {
    name: meta.name,
    symbol: meta.symbol,
    description: meta.description,
    image: imageUri,
    ...(bannerUri ? { banner: bannerUri } : {}),
    extensions: {
      website: meta.website || "",
      twitter: meta.twitter || "",
      telegram: meta.telegram || "",
      discord: meta.discord || "",
    },
    properties: {
      files: [
        { uri: imageUri, type: logo.type || "image/png" },
        ...(bannerUri && banner ? [{ uri: bannerUri, type: banner.type || "image/png" }] : []),
      ],
      category: "image",
      ...(meta.creatorAddress
        ? { creators: [{ address: meta.creatorAddress, share: 100 }] }
        : {}),
    },
  };

  if (meta.creatorName || meta.creatorAddress) {
    metadataJson.creator = {
      name: meta.creatorName || "",
      address: meta.creatorAddress || "",
    };
  }

  const metaRes = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "json", json: metadataJson }),
  });
  if (!metaRes.ok) {
    const err = await safeJson(metaRes);
    throw new Error(err?.error || "Metadata upload to IPFS failed");
  }
  const { uri: metadataUri } = await metaRes.json();

  return { imageUri, bannerUri, metadataUri };
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
