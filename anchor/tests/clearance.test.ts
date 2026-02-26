import * as anchor from '@coral-xyz/anchor'
import { Program, BN } from '@coral-xyz/anchor'
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount,
  getAccount,
} from '@solana/spl-token'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { create, mplCore } from '@metaplex-foundation/mpl-core'
import {
  generateSigner,
  createSignerFromKeypair,
  signerIdentity,
  publicKey as toUmiPublicKey,
} from '@metaplex-foundation/umi'
import type { Umi } from '@metaplex-foundation/umi'
import { Clearance } from '../target/types/clearance'

const MPL_CORE_PROGRAM_ID = new PublicKey(
  'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d',
)

describe('clearance', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.Clearance as Program<Clearance>
  const admin = provider.wallet as anchor.Wallet
  const user = Keypair.generate()

  const SESSION_ID = new BN(1)
  const DECIMALS = 6 // USDC uses 6 decimals
  const DEPOSIT_AMOUNT = 100_000_000 // 100 USDC
  const CLAIM_AMOUNT = 3_500_000 // 3.50 USDC

  let usdcMint: PublicKey
  let adminAta: PublicKey
  let vaultPda: PublicKey
  let vaultBump: number
  let vaultAta: PublicKey

  // Derive vault PDA
  function deriveVault(sessionId: BN): [PublicKey, number] {
    const buf = Buffer.alloc(8)
    buf.writeBigUInt64LE(BigInt(sessionId.toString()))
    return PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), buf],
      program.programId,
    )
  }

  function deriveClaimRecord(
    vault: PublicKey,
    claimer: PublicKey,
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('claim'), vault.toBuffer(), claimer.toBuffer()],
      program.programId,
    )
  }

  beforeAll(async () => {
    // Airdrop SOL to user so they can sign transactions
    const sig = await provider.connection.requestAirdrop(
      user.publicKey,
      2 * LAMPORTS_PER_SOL,
    )
    await provider.connection.confirmTransaction(sig)

    // Create a fake USDC mint (admin is mint authority)
    usdcMint = await createMint(
      provider.connection,
      (admin as any).payer,
      admin.publicKey,
      null,
      DECIMALS,
    )

    // Create admin's ATA and mint tokens
    const adminAtaAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      (admin as any).payer,
      usdcMint,
      admin.publicKey,
    )
    adminAta = adminAtaAccount.address

    await mintTo(
      provider.connection,
      (admin as any).payer,
      usdcMint,
      adminAta,
      admin.publicKey,
      1_000_000_000, // 1000 USDC
    )

    // Derive PDAs
    ;[vaultPda, vaultBump] = deriveVault(SESSION_ID)

    // Derive vault ATA (associated token account owned by vault PDA)
    vaultAta = anchor.utils.token.associatedAddress({
      mint: usdcMint,
      owner: vaultPda,
    })
  })

  it('Initialize vault for session 1', async () => {
    await program.methods
      .initializeVault(SESSION_ID)
      .accounts({
        admin: admin.publicKey,
        vault: vaultPda,
        vaultTokenAccount: vaultAta,
        usdcMint,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc()

    const vault = await program.account.vault.fetch(vaultPda)
    expect(vault.admin.toBase58()).toEqual(admin.publicKey.toBase58())
    expect(vault.usdcMint.toBase58()).toEqual(usdcMint.toBase58())
    expect(vault.sessionId.toNumber()).toEqual(1)
    expect(vault.totalDeposited.toNumber()).toEqual(0)
    expect(vault.totalClaimed.toNumber()).toEqual(0)
    expect(vault.bump).toEqual(vaultBump)
  })

  it('Deposit 100 USDC', async () => {
    await program.methods
      .deposit(new BN(DEPOSIT_AMOUNT))
      .accounts({
        admin: admin.publicKey,
        vault: vaultPda,
        adminTokenAccount: adminAta,
        vaultTokenAccount: vaultAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc()

    const vault = await program.account.vault.fetch(vaultPda)
    expect(vault.totalDeposited.toNumber()).toEqual(DEPOSIT_AMOUNT)

    const vaultTokenAcct = await getAccount(provider.connection, vaultAta)
    expect(Number(vaultTokenAcct.amount)).toEqual(DEPOSIT_AMOUNT)
  })

  it('Claim 3.50 USDC as user', async () => {
    const userAta = anchor.utils.token.associatedAddress({
      mint: usdcMint,
      owner: user.publicKey,
    })

    const [claimRecordPda] = deriveClaimRecord(vaultPda, user.publicKey)

    await program.methods
      .claim(new BN(CLAIM_AMOUNT))
      .accounts({
        admin: admin.publicKey,
        user: user.publicKey,
        vault: vaultPda,
        claimRecord: claimRecordPda,
        vaultTokenAccount: vaultAta,
        userTokenAccount: userAta,
        usdcMint,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc()

    // Check user received USDC
    const userTokenAcct = await getAccount(provider.connection, userAta)
    expect(Number(userTokenAcct.amount)).toEqual(CLAIM_AMOUNT)

    // Check vault totals updated
    const vault = await program.account.vault.fetch(vaultPda)
    expect(vault.totalClaimed.toNumber()).toEqual(CLAIM_AMOUNT)

    // Check claim record
    const claimRecord = await program.account.claimRecord.fetch(claimRecordPda)
    expect(claimRecord.user.toBase58()).toEqual(user.publicKey.toBase58())
    expect(claimRecord.vault.toBase58()).toEqual(vaultPda.toBase58())
    expect(claimRecord.amount.toNumber()).toEqual(CLAIM_AMOUNT)
    expect(claimRecord.claimedAt.toNumber()).toBeGreaterThan(0)
  })

  it('Double-claim fails (same user, same vault)', async () => {
    const userAta = anchor.utils.token.associatedAddress({
      mint: usdcMint,
      owner: user.publicKey,
    })
    const [claimRecordPda] = deriveClaimRecord(vaultPda, user.publicKey)

    await expect(
      program.methods
        .claim(new BN(CLAIM_AMOUNT))
        .accounts({
          admin: admin.publicKey,
          user: user.publicKey,
          vault: vaultPda,
          claimRecord: claimRecordPda,
          vaultTokenAccount: vaultAta,
          userTokenAccount: userAta,
          usdcMint,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc(),
    ).rejects.toThrow()
  })

  it('Claim > available fails (InsufficientFunds)', async () => {
    const bigClaimer = Keypair.generate()
    const sig = await provider.connection.requestAirdrop(
      bigClaimer.publicKey,
      LAMPORTS_PER_SOL,
    )
    await provider.connection.confirmTransaction(sig)

    const bigClaimerAta = anchor.utils.token.associatedAddress({
      mint: usdcMint,
      owner: bigClaimer.publicKey,
    })
    const [claimRecordPda] = deriveClaimRecord(vaultPda, bigClaimer.publicKey)

    // Try to claim more than what's available
    const tooMuch = DEPOSIT_AMOUNT // 100 USDC but only ~96.5 remains
    await expect(
      program.methods
        .claim(new BN(tooMuch))
        .accounts({
          admin: admin.publicKey,
          user: bigClaimer.publicKey,
          vault: vaultPda,
          claimRecord: claimRecordPda,
          vaultTokenAccount: vaultAta,
          userTokenAccount: bigClaimerAta,
          usdcMint,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([bigClaimer])
        .rpc(),
    ).rejects.toThrow()
  })

  it('Unauthorized close fails (imposter != admin)', async () => {
    const imposter = Keypair.generate()
    const sig = await provider.connection.requestAirdrop(
      imposter.publicKey,
      LAMPORTS_PER_SOL,
    )
    await provider.connection.confirmTransaction(sig)

    const imposterAta = anchor.utils.token.associatedAddress({
      mint: usdcMint,
      owner: imposter.publicKey,
    })

    await expect(
      program.methods
        .closeVault()
        .accounts({
          admin: imposter.publicKey,
          vault: vaultPda,
          vaultTokenAccount: vaultAta,
          adminTokenAccount: imposterAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([imposter])
        .rpc(),
    ).rejects.toThrow()
  })

  it('Close vault — admin recovers remaining USDC', async () => {
    const adminBefore = await getAccount(provider.connection, adminAta)
    const vaultTokenBefore = await getAccount(provider.connection, vaultAta)
    const remaining = Number(vaultTokenBefore.amount)

    await program.methods
      .closeVault()
      .accounts({
        admin: admin.publicKey,
        vault: vaultPda,
        vaultTokenAccount: vaultAta,
        adminTokenAccount: adminAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc()

    // Admin should have received the remaining USDC
    const adminAfter = await getAccount(provider.connection, adminAta)
    expect(Number(adminAfter.amount)).toEqual(
      Number(adminBefore.amount) + remaining,
    )

    // Vault account should be gone
    const vaultAccount = await program.account.vault.fetchNullable(vaultPda)
    expect(vaultAccount).toBeNull()
  })

  // -----------------------------------------------------------------------
  // claim_with_nft tests — uses real mpl-core assets (cloned from mainnet)
  // -----------------------------------------------------------------------
  describe('claim_with_nft', () => {
    const TIMEOUT = 30_000
    const SESSION_ID_2 = new BN(2)
    const NFT_CLAIM_AMOUNT = 5_000_000 // 5 USDC
    const nftUser = Keypair.generate()

    let umi: Umi
    let vault2Pda: PublicKey
    let vault2Ata: PublicKey
    let nftAssetPubkey: PublicKey // real mpl-core asset

    beforeAll(async () => {
      // --- Set up UMI pointing at the local test validator ---
      umi = createUmi(provider.connection.rpcEndpoint, 'confirmed').use(
        mplCore(),
      )
      const secretKey = new Uint8Array((admin as any).payer.secretKey)
      const adminKeypair = umi.eddsa.createKeypairFromSecretKey(secretKey)
      const adminSigner = createSignerFromKeypair(umi, adminKeypair)
      umi.use(signerIdentity(adminSigner, true)) // true = also set as payer

      // Fund nftUser
      const sig = await provider.connection.requestAirdrop(
        nftUser.publicKey,
        2 * LAMPORTS_PER_SOL,
      )
      await provider.connection.confirmTransaction(sig)

      // Derive vault 2
      ;[vault2Pda] = deriveVault(SESSION_ID_2)
      vault2Ata = anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: vault2Pda,
      })

      // Initialize vault 2
      await program.methods
        .initializeVault(SESSION_ID_2)
        .accounts({
          admin: admin.publicKey,
          vault: vault2Pda,
          vaultTokenAccount: vault2Ata,
          usdcMint,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc()

      // Deposit 100 USDC into vault 2
      await program.methods
        .deposit(new BN(DEPOSIT_AMOUNT))
        .accounts({
          admin: admin.publicKey,
          vault: vault2Pda,
          adminTokenAccount: adminAta,
          vaultTokenAccount: vault2Ata,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc()

      // Create a real mpl-core asset: owner = nftUser, updateAuthority = admin
      const asset = generateSigner(umi)
      await create(umi, {
        asset,
        name: 'Test Blind Box',
        uri: 'https://test.com/metadata.json',
        owner: toUmiPublicKey(nftUser.publicKey.toBase58()),
        updateAuthority: toUmiPublicKey(admin.publicKey.toBase58()),
      }).sendAndConfirm(umi)
      nftAssetPubkey = new PublicKey(asset.publicKey)
    }, TIMEOUT)

    it('claim_with_nft succeeds with valid NFT', async () => {
      const nftUserAta = anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: nftUser.publicKey,
      })
      const [claimRecordPda] = deriveClaimRecord(vault2Pda, nftUser.publicKey)

      await program.methods
        .claimWithNft(new BN(NFT_CLAIM_AMOUNT))
        .accounts({
          admin: admin.publicKey,
          user: nftUser.publicKey,
          vault: vault2Pda,
          claimRecord: claimRecordPda,
          vaultTokenAccount: vault2Ata,
          userTokenAccount: nftUserAta,
          usdcMint,
          nftAsset: nftAssetPubkey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([nftUser])
        .rpc()

      // User received USDC
      const userAcct = await getAccount(provider.connection, nftUserAta)
      expect(Number(userAcct.amount)).toEqual(NFT_CLAIM_AMOUNT)

      // Vault totals updated
      const vault = await program.account.vault.fetch(vault2Pda)
      expect(vault.totalClaimed.toNumber()).toEqual(NFT_CLAIM_AMOUNT)

      // Claim record created
      const claimRecord =
        await program.account.claimRecord.fetch(claimRecordPda)
      expect(claimRecord.user.toBase58()).toEqual(
        nftUser.publicKey.toBase58(),
      )
      expect(claimRecord.amount.toNumber()).toEqual(NFT_CLAIM_AMOUNT)
    }, TIMEOUT)

    it('claim_with_nft fails: NFT owner != user (NftOwnerMismatch)', async () => {
      const wrongUser = Keypair.generate()
      const sig = await provider.connection.requestAirdrop(
        wrongUser.publicKey,
        LAMPORTS_PER_SOL,
      )
      await provider.connection.confirmTransaction(sig)

      // nftAssetPubkey is owned by nftUser, but wrongUser is trying to claim
      const wrongUserAta = anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: wrongUser.publicKey,
      })
      const [claimRecordPda] = deriveClaimRecord(
        vault2Pda,
        wrongUser.publicKey,
      )

      await expect(
        program.methods
          .claimWithNft(new BN(NFT_CLAIM_AMOUNT))
          .accounts({
            admin: admin.publicKey,
            user: wrongUser.publicKey,
            vault: vault2Pda,
            claimRecord: claimRecordPda,
            vaultTokenAccount: vault2Ata,
            userTokenAccount: wrongUserAta,
            usdcMint,
            nftAsset: nftAssetPubkey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([wrongUser])
          .rpc(),
      ).rejects.toThrow(/NftOwnerMismatch/)
    }, TIMEOUT)

    it('claim_with_nft fails: NFT authority != admin (InvalidNftAuthority)', async () => {
      // Create a fresh user (nftUser already has a claim record)
      const freshUser = Keypair.generate()
      const sig = await provider.connection.requestAirdrop(
        freshUser.publicKey,
        LAMPORTS_PER_SOL,
      )
      await provider.connection.confirmTransaction(sig)

      // Create an asset with a wrong updateAuthority (not the vault admin)
      const fakeAuthority = Keypair.generate()
      const badAsset = generateSigner(umi)
      await create(umi, {
        asset: badAsset,
        name: 'Bad Authority NFT',
        uri: 'https://test.com/metadata.json',
        owner: toUmiPublicKey(freshUser.publicKey.toBase58()),
        updateAuthority: toUmiPublicKey(fakeAuthority.publicKey.toBase58()),
      }).sendAndConfirm(umi)

      const freshUserAta = anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: freshUser.publicKey,
      })
      const [claimRecordPda] = deriveClaimRecord(
        vault2Pda,
        freshUser.publicKey,
      )

      await expect(
        program.methods
          .claimWithNft(new BN(NFT_CLAIM_AMOUNT))
          .accounts({
            admin: admin.publicKey,
            user: freshUser.publicKey,
            vault: vault2Pda,
            claimRecord: claimRecordPda,
            vaultTokenAccount: vault2Ata,
            userTokenAccount: freshUserAta,
            usdcMint,
            nftAsset: new PublicKey(badAsset.publicKey),
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([freshUser])
          .rpc(),
      ).rejects.toThrow(/InvalidNftAuthority/)
    }, TIMEOUT)

    it('claim_with_nft fails: account not owned by mpl-core program (InvalidNftAccount)', async () => {
      const nonMplUser = Keypair.generate()
      const sig = await provider.connection.requestAirdrop(
        nonMplUser.publicKey,
        LAMPORTS_PER_SOL,
      )
      await provider.connection.confirmTransaction(sig)

      // Create an account owned by system program (not mpl-core)
      const fakeNft = Keypair.generate()
      const space = 100
      const rent =
        await provider.connection.getMinimumBalanceForRentExemption(space)
      const createIx = SystemProgram.createAccount({
        fromPubkey: admin.publicKey,
        newAccountPubkey: fakeNft.publicKey,
        lamports: rent,
        space,
        programId: SystemProgram.programId,
      })
      const tx = new Transaction().add(createIx)
      await provider.sendAndConfirm(tx, [fakeNft])

      const nonMplUserAta = anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: nonMplUser.publicKey,
      })
      const [claimRecordPda] = deriveClaimRecord(
        vault2Pda,
        nonMplUser.publicKey,
      )

      await expect(
        program.methods
          .claimWithNft(new BN(NFT_CLAIM_AMOUNT))
          .accounts({
            admin: admin.publicKey,
            user: nonMplUser.publicKey,
            vault: vault2Pda,
            claimRecord: claimRecordPda,
            vaultTokenAccount: vault2Ata,
            userTokenAccount: nonMplUserAta,
            usdcMint,
            nftAsset: fakeNft.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([nonMplUser])
          .rpc(),
      ).rejects.toThrow(/InvalidNftAccount/)
    }, TIMEOUT)
  })
})
