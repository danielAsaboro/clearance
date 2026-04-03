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

    function deriveUserAccount(user: PublicKey): [PublicKey, number] {
      return PublicKey.findProgramAddressSync(
        [Buffer.from('user_account'), user.toBuffer()],
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

    it('fan_deposit transfers entry fee to vault and creates UserAccount', async () => {
      const [depositRecordPda] = deriveFanDepositRecord(vault3Pda, fan.publicKey)
      const [userAccountPda] = deriveUserAccount(fan.publicKey)

      await program.methods
        .fanDeposit(new BN(ENTRY_AMOUNT))
        .accounts({
          fan: fan.publicKey,
          vault: vault3Pda,
          userAccount: userAccountPda,
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

      // UserAccount PDA created
      const userAccount = await program.account.userAccount.fetch(userAccountPda)
      expect(userAccount.user.toBase58()).toEqual(fan.publicKey.toBase58())
      expect(userAccount.usdcMint.toBase58()).toEqual(usdcMint.toBase58())
    })

    it('double fan_deposit fails (same fan, same vault)', async () => {
      const [depositRecordPda] = deriveFanDepositRecord(vault3Pda, fan.publicKey)
      const [userAccountPda] = deriveUserAccount(fan.publicKey)

      await expect(
        program.methods
          .fanDeposit(new BN(ENTRY_AMOUNT))
          .accounts({
            fan: fan.publicKey,
            vault: vault3Pda,
            userAccount: userAccountPda,
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
      const [userAccountPda] = deriveUserAccount(fan2.publicKey)

      await expect(
        program.methods
          .fanDeposit(new BN(0))
          .accounts({
            fan: fan2.publicKey,
            vault: vault3Pda,
            userAccount: userAccountPda,
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
  // finalize_vault, distribute_reward, withdraw tests
  // -----------------------------------------------------------------------
  describe('pool_rewards', () => {
    const SESSION_ID_5 = new BN(5)
    const ENTRY_AMOUNT = 10_000_000 // 10 USDC
    const REWARD_AMOUNT = 7_000_000 // 7 USDC pool reward
    const poolFan = Keypair.generate()
    const poolFan2 = Keypair.generate()

    let vault5Pda: PublicKey
    let vault5Ata: PublicKey
    let poolFanAta: PublicKey

    function deriveFanDepositRecord(
      vault: PublicKey,
      depositor: PublicKey,
    ): [PublicKey, number] {
      return PublicKey.findProgramAddressSync(
        [Buffer.from('deposit'), vault.toBuffer(), depositor.toBuffer()],
        program.programId,
      )
    }

    function deriveUserAccount(userPk: PublicKey): [PublicKey, number] {
      return PublicKey.findProgramAddressSync(
        [Buffer.from('user_account'), userPk.toBuffer()],
        program.programId,
      )
    }

    function deriveRewardRecord(
      vault: PublicKey,
      userPk: PublicKey,
    ): [PublicKey, number] {
      return PublicKey.findProgramAddressSync(
        [Buffer.from('reward'), vault.toBuffer(), userPk.toBuffer()],
        program.programId,
      )
    }

    beforeAll(async () => {
      // Fund fans
      for (const fan of [poolFan, poolFan2]) {
        const sig = await provider.connection.requestAirdrop(
          fan.publicKey,
          2 * LAMPORTS_PER_SOL,
        )
        await provider.connection.confirmTransaction(sig)
      }

      // Derive vault 5
      ;[vault5Pda] = deriveVault(SESSION_ID_5)
      vault5Ata = anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: vault5Pda,
      })

      // Initialize vault 5
      await program.methods
        .initializeVault(SESSION_ID_5)
        .accounts({
          admin: admin.publicKey,
          vault: vault5Pda,
          vaultTokenAccount: vault5Ata,
          usdcMint,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc()

      // Mint USDC to fan and have them deposit
      const fanAtaAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        (admin as any).payer,
        usdcMint,
        poolFan.publicKey,
      )
      poolFanAta = fanAtaAccount.address

      await mintTo(
        provider.connection,
        (admin as any).payer,
        usdcMint,
        poolFanAta,
        admin.publicKey,
        ENTRY_AMOUNT,
      )

      // Fan deposit into vault
      const [depositRecordPda] = deriveFanDepositRecord(vault5Pda, poolFan.publicKey)
      const [userAccountPda] = deriveUserAccount(poolFan.publicKey)

      await program.methods
        .fanDeposit(new BN(ENTRY_AMOUNT))
        .accounts({
          fan: poolFan.publicKey,
          vault: vault5Pda,
          userAccount: userAccountPda,
          depositRecord: depositRecordPda,
          fanTokenAccount: poolFanAta,
          vaultTokenAccount: vault5Ata,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([poolFan])
        .rpc()
    })

    // --- finalize_vault ---

    it('finalize_vault marks vault as finalized', async () => {
      const vaultBefore = await program.account.vault.fetch(vault5Pda)
      expect(vaultBefore.finalized).toEqual(false)

      await program.methods
        .finalizeVault()
        .accounts({
          admin: admin.publicKey,
          vault: vault5Pda,
        })
        .rpc()

      const vaultAfter = await program.account.vault.fetch(vault5Pda)
      expect(vaultAfter.finalized).toEqual(true)
    })

    it('finalize_vault fails if already finalized (AlreadyFinalized)', async () => {
      await expect(
        program.methods
          .finalizeVault()
          .accounts({
            admin: admin.publicKey,
            vault: vault5Pda,
          })
          .rpc(),
      ).rejects.toThrow(/AlreadyFinalized/)
    })

    it('finalize_vault fails with wrong admin (Unauthorized)', async () => {
      // Use a separate vault for this test
      const SESSION_ID_6 = new BN(6)
      const [vault6Pda] = deriveVault(SESSION_ID_6)
      const vault6Ata = anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: vault6Pda,
      })

      await program.methods
        .initializeVault(SESSION_ID_6)
        .accounts({
          admin: admin.publicKey,
          vault: vault6Pda,
          vaultTokenAccount: vault6Ata,
          usdcMint,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc()

      const imposter = Keypair.generate()
      const sig = await provider.connection.requestAirdrop(
        imposter.publicKey,
        LAMPORTS_PER_SOL,
      )
      await provider.connection.confirmTransaction(sig)

      await expect(
        program.methods
          .finalizeVault()
          .accounts({
            admin: imposter.publicKey,
            vault: vault6Pda,
          })
          .signers([imposter])
          .rpc(),
      ).rejects.toThrow()
    })

    it('fan_deposit fails on finalized vault (VaultFinalized)', async () => {
      const fan2AtaAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        (admin as any).payer,
        usdcMint,
        poolFan2.publicKey,
      )

      await mintTo(
        provider.connection,
        (admin as any).payer,
        usdcMint,
        fan2AtaAccount.address,
        admin.publicKey,
        ENTRY_AMOUNT,
      )

      const [depositRecordPda] = deriveFanDepositRecord(vault5Pda, poolFan2.publicKey)
      const [userAccountPda] = deriveUserAccount(poolFan2.publicKey)

      await expect(
        program.methods
          .fanDeposit(new BN(ENTRY_AMOUNT))
          .accounts({
            fan: poolFan2.publicKey,
            vault: vault5Pda,
            userAccount: userAccountPda,
            depositRecord: depositRecordPda,
            fanTokenAccount: fan2AtaAccount.address,
            vaultTokenAccount: vault5Ata,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([poolFan2])
          .rpc(),
      ).rejects.toThrow(/VaultFinalized/)
    })

    // --- claim_reward (user-initiated, admin co-signs) ---

    it('claim_reward moves USDC from vault to user PDA ATA', async () => {
      const [userAccountPda] = deriveUserAccount(poolFan.publicKey)
      const [rewardRecordPda] = deriveRewardRecord(vault5Pda, poolFan.publicKey)

      const userAccountAta = anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: userAccountPda,
      })

      await program.methods
        .claimReward(new BN(REWARD_AMOUNT))
        .accounts({
          admin: admin.publicKey,
          user: poolFan.publicKey,
          vault: vault5Pda,
          userAccount: userAccountPda,
          rewardRecord: rewardRecordPda,
          vaultTokenAccount: vault5Ata,
          userAccountToken: userAccountAta,
          usdcMint,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([poolFan])
        .rpc()

      // User account ATA should have the reward
      const userAcctToken = await getAccount(provider.connection, userAccountAta)
      expect(Number(userAcctToken.amount)).toEqual(REWARD_AMOUNT)

      // Vault total_claimed updated
      const vault = await program.account.vault.fetch(vault5Pda)
      expect(vault.totalClaimed.toNumber()).toEqual(REWARD_AMOUNT)

      // Reward record created
      const rewardRecord = await program.account.rewardRecord.fetch(rewardRecordPda)
      expect(rewardRecord.user.toBase58()).toEqual(poolFan.publicKey.toBase58())
      expect(rewardRecord.vault.toBase58()).toEqual(vault5Pda.toBase58())
      expect(rewardRecord.amount.toNumber()).toEqual(REWARD_AMOUNT)
      expect(rewardRecord.distributedAt.toNumber()).toBeGreaterThan(0)
    })

    it('claim_reward fails if double-claimed (same user, same vault)', async () => {
      const [userAccountPda] = deriveUserAccount(poolFan.publicKey)
      const [rewardRecordPda] = deriveRewardRecord(vault5Pda, poolFan.publicKey)

      const userAccountAta = anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: userAccountPda,
      })

      await expect(
        program.methods
          .claimReward(new BN(1_000_000))
          .accounts({
            admin: admin.publicKey,
            user: poolFan.publicKey,
            vault: vault5Pda,
            userAccount: userAccountPda,
            rewardRecord: rewardRecordPda,
            vaultTokenAccount: vault5Ata,
            userAccountToken: userAccountAta,
            usdcMint,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([poolFan])
          .rpc(),
      ).rejects.toThrow()
    })

    it('claim_reward fails if vault not finalized (VaultNotFinalized)', async () => {
      // Use vault 7 which is NOT finalized
      const SESSION_ID_7 = new BN(7)
      const [vault7Pda] = deriveVault(SESSION_ID_7)
      const vault7Ata = anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: vault7Pda,
      })

      await program.methods
        .initializeVault(SESSION_ID_7)
        .accounts({
          admin: admin.publicKey,
          vault: vault7Pda,
          vaultTokenAccount: vault7Ata,
          usdcMint,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc()

      // Deposit so there's something to distribute
      await program.methods
        .deposit(new BN(ENTRY_AMOUNT))
        .accounts({
          admin: admin.publicKey,
          vault: vault7Pda,
          adminTokenAccount: adminAta,
          vaultTokenAccount: vault7Ata,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc()

      const [userAccountPda] = deriveUserAccount(poolFan.publicKey)
      const [rewardRecordPda] = deriveRewardRecord(vault7Pda, poolFan.publicKey)
      const userAccountAta = anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: userAccountPda,
      })

      await expect(
        program.methods
          .claimReward(new BN(1_000_000))
          .accounts({
            admin: admin.publicKey,
            user: poolFan.publicKey,
            vault: vault7Pda,
            userAccount: userAccountPda,
            rewardRecord: rewardRecordPda,
            vaultTokenAccount: vault7Ata,
            userAccountToken: userAccountAta,
            usdcMint,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([poolFan])
          .rpc(),
      ).rejects.toThrow(/VaultNotFinalized/)
    })

    it('claim_reward fails if amount > available (InsufficientFunds)', async () => {
      // vault5 has 10 USDC deposited, 7 already claimed
      // Remaining = 3 USDC. Try distributing 5 USDC to another user.
      // First, create a new user account for poolFan2 via a different vault deposit
      // Since poolFan2 doesn't have a UserAccount yet, we need to create one first
      // Use vault7 which is not finalized to do a deposit for poolFan2

      // Actually, let's just try to distribute more than available to poolFan
      // poolFan already got their reward record. We need a fresh user.
      // Let's use a fresh vault for a cleaner test.
      const SESSION_ID_8 = new BN(8)
      const [vault8Pda] = deriveVault(SESSION_ID_8)
      const vault8Ata = anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: vault8Pda,
      })

      await program.methods
        .initializeVault(SESSION_ID_8)
        .accounts({
          admin: admin.publicKey,
          vault: vault8Pda,
          vaultTokenAccount: vault8Ata,
          usdcMint,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc()

      // Deposit only 1 USDC
      await program.methods
        .deposit(new BN(1_000_000))
        .accounts({
          admin: admin.publicKey,
          vault: vault8Pda,
          adminTokenAccount: adminAta,
          vaultTokenAccount: vault8Ata,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc()

      // Finalize
      await program.methods
        .finalizeVault()
        .accounts({
          admin: admin.publicKey,
          vault: vault8Pda,
        })
        .rpc()

      // Try to distribute 5 USDC when only 1 is available
      const [userAccountPda] = deriveUserAccount(poolFan.publicKey)
      const [rewardRecordPda] = deriveRewardRecord(vault8Pda, poolFan.publicKey)
      const userAccountAta = anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: userAccountPda,
      })

      await expect(
        program.methods
          .claimReward(new BN(5_000_000))
          .accounts({
            admin: admin.publicKey,
            user: poolFan.publicKey,
            vault: vault8Pda,
            userAccount: userAccountPda,
            rewardRecord: rewardRecordPda,
            vaultTokenAccount: vault8Ata,
            userAccountToken: userAccountAta,
            usdcMint,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([poolFan])
          .rpc(),
      ).rejects.toThrow(/InsufficientFunds/)
    })

    // --- withdraw ---

    it('withdraw moves USDC from user PDA ATA to wallet', async () => {
      const [userAccountPda] = deriveUserAccount(poolFan.publicKey)
      const userAccountAta = anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: userAccountPda,
      })

      // Check user PDA ATA balance before
      const pdaBalanceBefore = await getAccount(provider.connection, userAccountAta)
      expect(Number(pdaBalanceBefore.amount)).toEqual(REWARD_AMOUNT)

      // Fan wallet ATA balance before
      const walletBalanceBefore = await getAccount(provider.connection, poolFanAta)
      const walletBefore = Number(walletBalanceBefore.amount)

      await program.methods
        .withdraw(new BN(REWARD_AMOUNT))
        .accounts({
          user: poolFan.publicKey,
          userAccount: userAccountPda,
          userAccountToken: userAccountAta,
          userTokenAccount: poolFanAta,
          usdcMint,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([poolFan])
        .rpc()

      // PDA ATA should be empty
      const pdaBalanceAfter = await getAccount(provider.connection, userAccountAta)
      expect(Number(pdaBalanceAfter.amount)).toEqual(0)

      // Fan wallet should have received the USDC
      const walletBalanceAfter = await getAccount(provider.connection, poolFanAta)
      expect(Number(walletBalanceAfter.amount)).toEqual(walletBefore + REWARD_AMOUNT)
    })

    it('withdraw fails with zero amount (ZeroAmount)', async () => {
      const [userAccountPda] = deriveUserAccount(poolFan.publicKey)
      const userAccountAta = anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: userAccountPda,
      })

      await expect(
        program.methods
          .withdraw(new BN(0))
          .accounts({
            user: poolFan.publicKey,
            userAccount: userAccountPda,
            userAccountToken: userAccountAta,
            userTokenAccount: poolFanAta,
            usdcMint,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([poolFan])
          .rpc(),
      ).rejects.toThrow(/ZeroAmount/)
    })

    it('withdraw fails if amount > PDA balance (insufficient funds)', async () => {
      const [userAccountPda] = deriveUserAccount(poolFan.publicKey)
      const userAccountAta = anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: userAccountPda,
      })

      // PDA ATA is empty (already withdrawn), try to withdraw 1 USDC
      await expect(
        program.methods
          .withdraw(new BN(1_000_000))
          .accounts({
            user: poolFan.publicKey,
            userAccount: userAccountPda,
            userAccountToken: userAccountAta,
            userTokenAccount: poolFanAta,
            usdcMint,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([poolFan])
          .rpc(),
      ).rejects.toThrow()
    })

    it('withdraw fails if wrong user tries to withdraw (Unauthorized)', async () => {
      // poolFan's PDA is empty, but let's test the constraint
      const imposter = Keypair.generate()
      const sig = await provider.connection.requestAirdrop(
        imposter.publicKey,
        LAMPORTS_PER_SOL,
      )
      await provider.connection.confirmTransaction(sig)

      // Derive poolFan's user account PDA but try to use imposter as signer
      // The seeds won't match since seeds use user.key()
      const [imposterAccountPda] = deriveUserAccount(imposter.publicKey)

      // imposter doesn't have a UserAccount — fetch should fail
      const acct = await program.account.userAccount.fetchNullable(imposterAccountPda)
      expect(acct).toBeNull()

      // Even if we try passing poolFan's PDA, seeds won't match imposter signer
      const [poolFanAccountPda] = deriveUserAccount(poolFan.publicKey)
      const poolFanAccountAta = anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: poolFanAccountPda,
      })
      const imposterAta = anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: imposter.publicKey,
      })

      await expect(
        program.methods
          .withdraw(new BN(1_000_000))
          .accounts({
            user: imposter.publicKey,
            userAccount: poolFanAccountPda, // mismatched seeds
            userAccountToken: poolFanAccountAta,
            userTokenAccount: imposterAta,
            usdcMint,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([imposter])
          .rpc(),
      ).rejects.toThrow()
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

})
