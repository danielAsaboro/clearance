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
import type { Clearance as Spotrtv } from '../target/types/clearance'

const MPL_CORE_PROGRAM_ID = new PublicKey(
  'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d',
)

describe('spotrtv', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.Spotrtv as Program<Spotrtv>
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
  // fan_deposit tests — fan pays entry fee directly into vault
  // -----------------------------------------------------------------------
  describe('fan_deposit', () => {
    const SESSION_ID_3 = new BN(3)
    const ENTRY_AMOUNT = 3_500_000 // 3.50 USDC
    const fan = Keypair.generate()

    let vault3Pda: PublicKey
    let vault3Ata: PublicKey
    let fanAta: PublicKey

    function deriveFanDepositRecord(
      vault: PublicKey,
      depositor: PublicKey,
    ): [PublicKey, number] {
      return PublicKey.findProgramAddressSync(
        [Buffer.from('deposit'), vault.toBuffer(), depositor.toBuffer()],
        program.programId,
      )
    }

    beforeAll(async () => {
      // Fund fan
      const sig = await provider.connection.requestAirdrop(
        fan.publicKey,
        2 * LAMPORTS_PER_SOL,
      )
      await provider.connection.confirmTransaction(sig)

      // Derive vault 3
      ;[vault3Pda] = deriveVault(SESSION_ID_3)
      vault3Ata = anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: vault3Pda,
      })

      // Initialize vault 3
      await program.methods
        .initializeVault(SESSION_ID_3)
        .accounts({
          admin: admin.publicKey,
          vault: vault3Pda,
          vaultTokenAccount: vault3Ata,
          usdcMint,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc()

      // Mint USDC directly to fan's ATA
      const fanAtaAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        (admin as any).payer,
        usdcMint,
        fan.publicKey,
      )
      fanAta = fanAtaAccount.address

      await mintTo(
        provider.connection,
        (admin as any).payer,
        usdcMint,
        fanAta,
        admin.publicKey,
        10_000_000, // 10 USDC for testing
      )
    })

    it('fan_deposit transfers entry fee to vault', async () => {
      const [depositRecordPda] = deriveFanDepositRecord(vault3Pda, fan.publicKey)

      await program.methods
        .fanDeposit(new BN(ENTRY_AMOUNT))
        .accounts({
          fan: fan.publicKey,
          vault: vault3Pda,
          depositRecord: depositRecordPda,
          fanTokenAccount: fanAta,
          vaultTokenAccount: vault3Ata,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([fan])
        .rpc()

      // Vault balance should be ENTRY_AMOUNT
      const vaultTokenAcct = await getAccount(provider.connection, vault3Ata)
      expect(Number(vaultTokenAcct.amount)).toEqual(ENTRY_AMOUNT)

      // Vault total_deposited updated
      const vault = await program.account.vault.fetch(vault3Pda)
      expect(vault.totalDeposited.toNumber()).toEqual(ENTRY_AMOUNT)

      // Fan deposit record created
      const depositRecord = await program.account.fanDepositRecord.fetch(depositRecordPda)
      expect(depositRecord.user.toBase58()).toEqual(fan.publicKey.toBase58())
      expect(depositRecord.vault.toBase58()).toEqual(vault3Pda.toBase58())
      expect(depositRecord.sessionId.toNumber()).toEqual(3)
      expect(depositRecord.amountDeposited.toNumber()).toEqual(ENTRY_AMOUNT)
      expect(depositRecord.depositedAt.toNumber()).toBeGreaterThan(0)
    })

    it('double fan_deposit fails (same fan, same vault)', async () => {
      const [depositRecordPda] = deriveFanDepositRecord(vault3Pda, fan.publicKey)

      await expect(
        program.methods
          .fanDeposit(new BN(ENTRY_AMOUNT))
          .accounts({
            fan: fan.publicKey,
            vault: vault3Pda,
            depositRecord: depositRecordPda,
            fanTokenAccount: fanAta,
            vaultTokenAccount: vault3Ata,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([fan])
          .rpc(),
      ).rejects.toThrow()
    })

    it('fan_deposit with zero amount fails (ZeroAmount)', async () => {
      const fan2 = Keypair.generate()
      const sig = await provider.connection.requestAirdrop(
        fan2.publicKey,
        LAMPORTS_PER_SOL,
      )
      await provider.connection.confirmTransaction(sig)

      const fan2AtaAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        (admin as any).payer,
        usdcMint,
        fan2.publicKey,
      )
      await mintTo(
        provider.connection,
        (admin as any).payer,
        usdcMint,
        fan2AtaAccount.address,
        admin.publicKey,
        ENTRY_AMOUNT,
      )

      const [depositRecordPda] = deriveFanDepositRecord(vault3Pda, fan2.publicKey)

      await expect(
        program.methods
          .fanDeposit(new BN(0))
          .accounts({
            fan: fan2.publicKey,
            vault: vault3Pda,
            depositRecord: depositRecordPda,
            fanTokenAccount: fan2AtaAccount.address,
            vaultTokenAccount: vault3Ata,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([fan2])
          .rpc(),
      ).rejects.toThrow(/ZeroAmount/)
    })
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

  // -----------------------------------------------------------------------
  // raffle_vrf tests — VRF-based raffle with testing feature
  // -----------------------------------------------------------------------
  describe('raffle_vrf', () => {
    const TIMEOUT = 30_000
    const SESSION_ID_4 = new BN(4)
    const raffleFan = Keypair.generate()
    const raffleFan2 = Keypair.generate()
    const raffleFan3 = Keypair.generate()

    let vault4Pda: PublicKey
    let vault4Ata: PublicKey
    let raffleNftPubkey: PublicKey

    let umi: Umi

    function deriveRaffleRecord(
      vault: PublicKey,
      fan: PublicKey,
    ): [PublicKey, number] {
      return PublicKey.findProgramAddressSync(
        [Buffer.from('raffle'), vault.toBuffer(), fan.toBuffer()],
        program.programId,
      )
    }

    beforeAll(async () => {
      // Set up UMI
      umi = createUmi(provider.connection.rpcEndpoint, 'confirmed').use(
        mplCore(),
      )
      const secretKey = new Uint8Array((admin as any).payer.secretKey)
      const adminKeypair = umi.eddsa.createKeypairFromSecretKey(secretKey)
      const adminSigner = createSignerFromKeypair(umi, adminKeypair)
      umi.use(signerIdentity(adminSigner, true))

      // Fund fans
      for (const fan of [raffleFan, raffleFan2, raffleFan3]) {
        const sig = await provider.connection.requestAirdrop(
          fan.publicKey,
          2 * LAMPORTS_PER_SOL,
        )
        await provider.connection.confirmTransaction(sig)
      }

      // Derive vault 4
      ;[vault4Pda] = deriveVault(SESSION_ID_4)
      vault4Ata = anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: vault4Pda,
      })

      // Initialize vault 4
      await program.methods
        .initializeVault(SESSION_ID_4)
        .accounts({
          admin: admin.publicKey,
          vault: vault4Pda,
          vaultTokenAccount: vault4Ata,
          usdcMint,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc()

      // Deposit 100 USDC into vault 4
      await program.methods
        .deposit(new BN(DEPOSIT_AMOUNT))
        .accounts({
          admin: admin.publicKey,
          vault: vault4Pda,
          adminTokenAccount: adminAta,
          vaultTokenAccount: vault4Ata,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc()

      // Create a real mpl-core asset for raffleFan: owner = raffleFan, updateAuthority = admin
      const asset = generateSigner(umi)
      await create(umi, {
        asset,
        name: 'Test Raffle Blind Box',
        uri: 'https://test.com/metadata.json',
        owner: toUmiPublicKey(raffleFan.publicKey.toBase58()),
        updateAuthority: toUmiPublicKey(admin.publicKey.toBase58()),
      }).sendAndConfirm(umi)
      raffleNftPubkey = new PublicKey(asset.publicKey)
    }, TIMEOUT)

    it('request_raffle creates RaffleRecord(resolved=false)', async () => {
      const [raffleRecordPda] = deriveRaffleRecord(vault4Pda, raffleFan.publicKey)

      await program.methods
        .requestRaffle(2) // tier = gold
        .accounts({
          fan: raffleFan.publicKey,
          admin: admin.publicKey,
          vault: vault4Pda,
          raffleRecord: raffleRecordPda,
          oracleQueue: admin.publicKey, // dummy in testing
          programIdentity: admin.publicKey, // dummy in testing
          slotHashes: admin.publicKey, // dummy in testing
          systemProgram: SystemProgram.programId,
        })
        .signers([raffleFan])
        .rpc()

      const raffleRecord = await program.account.raffleRecord.fetch(raffleRecordPda)
      expect(raffleRecord.fan.toBase58()).toEqual(raffleFan.publicKey.toBase58())
      expect(raffleRecord.vault.toBase58()).toEqual(vault4Pda.toBase58())
      expect(raffleRecord.tier).toEqual(2)
      expect(raffleRecord.resolved).toEqual(false)
      expect(raffleRecord.rewardAmount.toNumber()).toEqual(0)
    })

    it('callback_raffle resolves gold tier correctly', async () => {
      // --- Part A: High payout (randomness[0] = 0 < 26) ---
      const [raffleRecordPda] = deriveRaffleRecord(vault4Pda, raffleFan.publicKey)

      const highRandomness = new Array(32).fill(0)
      highRandomness[0] = 0 // < 26 → high payout

      await program.methods
        .callbackRaffle(highRandomness)
        .accounts({
          vrfProgramIdentity: admin.publicKey, // admin acts as oracle in testing
          raffleRecord: raffleRecordPda,
        })
        .rpc()

      const record = await program.account.raffleRecord.fetch(raffleRecordPda)
      expect(record.resolved).toEqual(true)
      expect(record.rewardAmount.toNumber()).toEqual(3_500_000) // Gold high = $3.50

      // --- Part B: Low payout (randomness[0] = 100 >= 26) ---
      // Need a second fan with their own RaffleRecord
      const [raffleRecord2Pda] = deriveRaffleRecord(vault4Pda, raffleFan2.publicKey)

      await program.methods
        .requestRaffle(2) // tier = gold
        .accounts({
          fan: raffleFan2.publicKey,
          admin: admin.publicKey,
          vault: vault4Pda,
          raffleRecord: raffleRecord2Pda,
          oracleQueue: admin.publicKey,
          programIdentity: admin.publicKey,
          slotHashes: admin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([raffleFan2])
        .rpc()

      const lowRandomness = new Array(32).fill(0)
      lowRandomness[0] = 100 // >= 26 → low payout

      await program.methods
        .callbackRaffle(lowRandomness)
        .accounts({
          vrfProgramIdentity: admin.publicKey,
          raffleRecord: raffleRecord2Pda,
        })
        .rpc()

      const record2 = await program.account.raffleRecord.fetch(raffleRecord2Pda)
      expect(record2.resolved).toEqual(true)
      expect(record2.rewardAmount.toNumber()).toEqual(1_750_000) // Gold low = $1.75
    }, TIMEOUT)

    it('claim_with_raffle transfers resolved reward amount', async () => {
      const [raffleRecordPda] = deriveRaffleRecord(vault4Pda, raffleFan.publicKey)
      const [claimRecordPda] = deriveClaimRecord(vault4Pda, raffleFan.publicKey)

      const fanAta = anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: raffleFan.publicKey,
      })

      await program.methods
        .claimWithRaffle()
        .accounts({
          admin: admin.publicKey,
          fan: raffleFan.publicKey,
          vault: vault4Pda,
          raffleRecord: raffleRecordPda,
          claimRecord: claimRecordPda,
          vaultTokenAccount: vault4Ata,
          fanTokenAccount: fanAta,
          usdcMint,
          nftAsset: raffleNftPubkey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([raffleFan])
        .rpc()

      // Fan received 3.5 USDC (the high payout amount from callback)
      const fanTokenAcct = await getAccount(provider.connection, fanAta)
      expect(Number(fanTokenAcct.amount)).toEqual(3_500_000)

      // Vault totals updated
      const vault = await program.account.vault.fetch(vault4Pda)
      expect(vault.totalClaimed.toNumber()).toEqual(3_500_000)

      // Claim record created
      const claimRecord = await program.account.claimRecord.fetch(claimRecordPda)
      expect(claimRecord.user.toBase58()).toEqual(raffleFan.publicKey.toBase58())
      expect(claimRecord.amount.toNumber()).toEqual(3_500_000)
    }, TIMEOUT)

    it('claim_with_raffle fails if raffle not resolved', async () => {
      // Create RaffleRecord for raffleFan3 but skip callback
      const [raffleRecord3Pda] = deriveRaffleRecord(vault4Pda, raffleFan3.publicKey)

      await program.methods
        .requestRaffle(1) // tier = base
        .accounts({
          fan: raffleFan3.publicKey,
          admin: admin.publicKey,
          vault: vault4Pda,
          raffleRecord: raffleRecord3Pda,
          oracleQueue: admin.publicKey,
          programIdentity: admin.publicKey,
          slotHashes: admin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([raffleFan3])
        .rpc()

      // Create a dummy NFT for fan3
      const fan3Asset = generateSigner(umi)
      await create(umi, {
        asset: fan3Asset,
        name: 'Fan3 Blind Box',
        uri: 'https://test.com/metadata.json',
        owner: toUmiPublicKey(raffleFan3.publicKey.toBase58()),
        updateAuthority: toUmiPublicKey(admin.publicKey.toBase58()),
      }).sendAndConfirm(umi)

      const [claimRecord3Pda] = deriveClaimRecord(vault4Pda, raffleFan3.publicKey)
      const fan3Ata = anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: raffleFan3.publicKey,
      })

      // Attempt claim without callback → should fail with RaffleNotResolved
      await expect(
        program.methods
          .claimWithRaffle()
          .accounts({
            admin: admin.publicKey,
            fan: raffleFan3.publicKey,
            vault: vault4Pda,
            raffleRecord: raffleRecord3Pda,
            claimRecord: claimRecord3Pda,
            vaultTokenAccount: vault4Ata,
            fanTokenAccount: fan3Ata,
            usdcMint,
            nftAsset: new PublicKey(fan3Asset.publicKey),
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([raffleFan3])
          .rpc(),
      ).rejects.toThrow(/RaffleNotResolved/)
    }, TIMEOUT)
  })
})
