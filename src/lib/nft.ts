import {
  createCollection,
  create,
  fetchAsset,
  update,
} from "@metaplex-foundation/mpl-core";
import {
  generateSigner,
  publicKey,
  type Umi,
  type KeypairSigner,
} from "@metaplex-foundation/umi";
import { uploadNftMetadata } from "@/lib/nft-metadata";
import { serverEnv } from "@/lib/env";

export interface BlindBoxMetadata {
  tier: "participation" | "base" | "gold";
  rewardAmount: number;
  sessionWeek: number;
  revealed: boolean;
}

// Create a Blind Box collection for a session
export async function createBlindBoxCollection(
  umi: Umi,
  signer: KeypairSigner,
  sessionWeek: number
) {
  const collectionSigner = generateSigner(umi);

  const metadataUri = await uploadNftMetadata({
    name: `Spotr TV Blind Box — Week ${sessionWeek}`,
    description: `Blind Box NFT collection for Spotr TV Week ${sessionWeek}. Reveal your box to discover your reward tier.`,
    image: `${serverEnv.NEXT_PUBLIC_APP_URL}/icon-512x512.png`,
    external_url: serverEnv.NEXT_PUBLIC_APP_URL,
    attributes: [
      { trait_type: "Season", value: "1" },
      { trait_type: "Week", value: sessionWeek.toString() },
      { trait_type: "Type", value: "Collection" },
    ],
  }, `collections/week-${sessionWeek}`);

  await createCollection(umi, {
    collection: collectionSigner,
    name: `Spotr TV Blind Box — Week ${sessionWeek}`,
    uri: metadataUri,
    updateAuthority: signer.publicKey,
  }).sendAndConfirm(umi);

  return collectionSigner.publicKey;
}

// Mint a Blind Box NFT
export async function mintBlindBox(
  umi: Umi,
  signer: KeypairSigner,
  walletAddress: string,
  tier: "participation" | "base" | "gold",
  rewardAmount: number,
  sessionWeek: number,
  collectionAddress?: string
) {
  const assetSigner = generateSigner(umi);
  const owner = publicKey(walletAddress);

  const tierNames: Record<string, string> = {
    participation: "Mystery Box — Participation",
    base: "Mystery Box — Base",
    gold: "Mystery Box — Gold",
  };

  const tierImages: Record<string, string> = {
    participation: "/icon-192x192.png",
    base: "/icon-512x512.png",
    gold: "/icon-512x512.png",
  };

  const name = tierNames[tier] || "Mystery Box";
  const assetId = assetSigner.publicKey.toString();

  const metadataUri = await uploadNftMetadata({
    name,
    description: `A mystery Blind Box from Spotr TV Week ${sessionWeek}. Reveal to discover your reward tier and claim USDC.`,
    image: `${serverEnv.NEXT_PUBLIC_APP_URL}${tierImages[tier] ?? "/icon-512x512.png"}`,
    external_url: `${serverEnv.NEXT_PUBLIC_APP_URL}/rewards`,
    attributes: [
      { trait_type: "Tier", value: tier },
      { trait_type: "Reward", value: `${rewardAmount} USDC` },
      { trait_type: "Week", value: sessionWeek.toString() },
      { trait_type: "Revealed", value: "false" },
    ],
  }, `nfts/${assetId}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createArgs: any = {
    asset: assetSigner,
    name,
    uri: metadataUri,
    owner,
    plugins: [
      {
        type: "Attributes",
        attributeList: [
          { key: "tier", value: tier },
          { key: "reward", value: rewardAmount.toString() },
          { key: "session_week", value: sessionWeek.toString() },
          { key: "revealed", value: "false" },
        ],
      },
      {
        type: "FreezeDelegate",
        frozen: tier === "participation",
        authority: { type: "UpdateAuthority" },
      },
    ],
  };

  if (collectionAddress) {
    createArgs.collection = publicKey(collectionAddress);
  }

  await create(umi, createArgs).sendAndConfirm(umi);
  return assetSigner.publicKey.toString();
}

// Reveal a Blind Box NFT
export async function revealBlindBox(
  umi: Umi,
  _signer: KeypairSigner,
  assetAddress: string,
  collectionAddress?: string
) {
  const asset = publicKey(assetAddress);
  const assetData = await fetchAsset(umi, asset);

  const attributesPlugin = assetData.attributes;
  if (!attributesPlugin) {
    throw new Error("Asset has no attributes");
  }

  const updatedAttributes = attributesPlugin.attributeList.map((attr) => {
    if (attr.key === "revealed") {
      return { ...attr, value: "true" };
    }
    return attr;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateArgs: any = {
    asset,
    name: assetData.name.replace("Mystery Box", "Blind Box — Revealed"),
    plugins: [
      {
        type: "Attributes",
        attributeList: updatedAttributes,
      },
      {
        type: "FreezeDelegate",
        frozen: true,
        authority: { type: "UpdateAuthority" },
      },
    ],
  };

  if (collectionAddress) {
    updateArgs.collection = publicKey(collectionAddress);
  }

  await update(umi, updateArgs).sendAndConfirm(umi);
  return true;
}
