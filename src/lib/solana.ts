import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplCore } from "@metaplex-foundation/mpl-core";
import {
  createSignerFromKeypair,
  signerIdentity,
  type KeypairSigner,
  type Umi,
} from "@metaplex-foundation/umi";
import { serverEnv } from "@/lib/env";

let _umi: Umi | null = null;
let _signer: KeypairSigner | null = null;

function getMintAuthoritySigner(umi: Umi): KeypairSigner {
  if (_signer) return _signer;

  const secretKeyArray = JSON.parse(serverEnv.SOLANA_MINT_AUTHORITY_SECRET_KEY) as number[];
  const secretKey = new Uint8Array(secretKeyArray);
  const keypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
  _signer = createSignerFromKeypair(umi, keypair);

  return _signer;
}

export function getUmi(): Umi {
  if (_umi) return _umi;

  const umi = createUmi(serverEnv.NEXT_PUBLIC_SOLANA_RPC_URL).use(mplCore());
  const signer = getMintAuthoritySigner(umi);
  umi.use(signerIdentity(signer));

  _umi = umi;
  return umi;
}

export function getMintAuthority(): KeypairSigner {
  const umi = getUmi();
  return getMintAuthoritySigner(umi);
}
