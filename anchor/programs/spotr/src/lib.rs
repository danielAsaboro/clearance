#![allow(clippy::result_large_err)]
#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{
    close_account as close_token_account, transfer, CloseAccount as CloseTokenAccount, Mint,
    Token, TokenAccount, Transfer,
};

declare_id!("D3pfeCb4sgYoHWXcYbeKtQbUSJBoDPorp6kETv1SexxU");

// Metaplex Core constants for raw byte parsing
const MPL_CORE_PROGRAM_ID: Pubkey = Pubkey::from_str_const("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
const MPL_CORE_KEY_ASSET: u8 = 1;
const MPL_CORE_UA_TYPE_ADDRESS: u8 = 1;

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

#[program]
pub mod spotrtv {
    use super::*;

    /// Create a per-session vault PDA and its associated USDC token account.
    pub fn initialize_vault(ctx: Context<InitializeVault>, session_id: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.admin = ctx.accounts.admin.key();
        vault.usdc_mint = ctx.accounts.usdc_mint.key();
        vault.session_id = session_id;
        vault.total_deposited = 0;
        vault.total_claimed = 0;
        vault.bump = ctx.bumps.vault;
        Ok(())
    }

    /// Admin deposits USDC into the vault token account.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, SpotrError::ZeroAmount);

        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.admin_token_account.to_account_info(),
                    to: ctx.accounts.vault_token_account.to_account_info(),
                    authority: ctx.accounts.admin.to_account_info(),
                },
            ),
            amount,
        )?;

        let vault = &mut ctx.accounts.vault;
        vault.total_deposited = vault
            .total_deposited
            .checked_add(amount)
            .ok_or(SpotrError::Overflow)?;

        Ok(())
    }

    /// User claims USDC from the vault. Admin co-signs to authorize the amount.
    /// A ClaimRecord PDA is created — if it already exists the tx fails (double-claim prevention).
    pub fn claim(ctx: Context<Claim>, amount: u64) -> Result<()> {
        require!(amount > 0, SpotrError::ZeroAmount);

        let vault = &ctx.accounts.vault;
        let available = vault
            .total_deposited
            .checked_sub(vault.total_claimed)
            .ok_or(SpotrError::Overflow)?;
        require!(amount <= available, SpotrError::InsufficientFunds);

        // PDA signer seeds for the vault
        let session_bytes = vault.session_id.to_le_bytes();
        let bump = &[vault.bump];
        let seeds: &[&[u8]] = &[b"vault", session_bytes.as_ref(), bump];
        let signer_seeds = &[seeds];

        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        // Update vault totals
        let vault = &mut ctx.accounts.vault;
        vault.total_claimed = vault
            .total_claimed
            .checked_add(amount)
            .ok_or(SpotrError::Overflow)?;

        // Fill claim record
        let claim_record = &mut ctx.accounts.claim_record;
        claim_record.user = ctx.accounts.user.key();
        claim_record.vault = vault.key();
        claim_record.amount = amount;
        claim_record.claimed_at = Clock::get()?.unix_timestamp;
        claim_record.bump = ctx.bumps.claim_record;

        Ok(())
    }

    /// User claims USDC by proving ownership of a revealed Metaplex Core blind box NFT.
    /// Admin co-signs to attest the NFT is revealed + frozen (checked server-side).
    /// The NFT asset is verified on-chain via raw byte parsing of its account data.
    pub fn claim_with_nft(ctx: Context<ClaimWithNft>, amount: u64) -> Result<()> {
        require!(amount > 0, SpotrError::ZeroAmount);

        // ---- Verify the NFT asset via raw byte parsing ----
        let nft_data = ctx.accounts.nft_asset.try_borrow_data()?;
        // Minimum size: 1 (key) + 32 (owner) + 1 (UA discriminator) + 32 (UA address) = 66 bytes
        require!(nft_data.len() >= 66, SpotrError::InvalidNftAccount);
        // Byte 0: Key discriminator must be Asset (1)
        require!(nft_data[0] == MPL_CORE_KEY_ASSET, SpotrError::InvalidNftAccount);
        // Bytes 1..33: asset owner must be the claiming user
        let nft_owner = Pubkey::try_from(&nft_data[1..33])
            .map_err(|_| error!(SpotrError::InvalidNftAccount))?;
        require!(nft_owner == ctx.accounts.user.key(), SpotrError::NftOwnerMismatch);
        // Byte 33: UpdateAuthority discriminator must be Address (1)
        require!(nft_data[33] == MPL_CORE_UA_TYPE_ADDRESS, SpotrError::InvalidNftAuthority);
        // Bytes 34..66: update authority address must be the vault admin
        let nft_authority = Pubkey::try_from(&nft_data[34..66])
            .map_err(|_| error!(SpotrError::InvalidNftAccount))?;
        require!(nft_authority == ctx.accounts.admin.key(), SpotrError::InvalidNftAuthority);
        // Drop the borrow before CPI
        drop(nft_data);

        // ---- Same vault claim logic as `claim` ----
        let vault = &ctx.accounts.vault;
        let available = vault
            .total_deposited
            .checked_sub(vault.total_claimed)
            .ok_or(SpotrError::Overflow)?;
        require!(amount <= available, SpotrError::InsufficientFunds);

        let session_bytes = vault.session_id.to_le_bytes();
        let bump = &[vault.bump];
        let seeds: &[&[u8]] = &[b"vault", session_bytes.as_ref(), bump];
        let signer_seeds = &[seeds];

        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        let vault = &mut ctx.accounts.vault;
        vault.total_claimed = vault
            .total_claimed
            .checked_add(amount)
            .ok_or(SpotrError::Overflow)?;

        let claim_record = &mut ctx.accounts.claim_record;
        claim_record.user = ctx.accounts.user.key();
        claim_record.vault = vault.key();
        claim_record.amount = amount;
        claim_record.claimed_at = Clock::get()?.unix_timestamp;
        claim_record.bump = ctx.bumps.claim_record;

        Ok(())
    }

    /// Fan deposits $3.50 USDC entry fee directly into the vault.
    /// A FanDepositRecord PDA is created — if it already exists the tx fails (double-entry prevention).
    pub fn fan_deposit(ctx: Context<FanDeposit>, amount: u64) -> Result<()> {
        require!(amount > 0, SpotrError::ZeroAmount);

        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.fan_token_account.to_account_info(),
                    to: ctx.accounts.vault_token_account.to_account_info(),
                    authority: ctx.accounts.fan.to_account_info(),
                },
            ),
            amount,
        )?;

        let vault = &mut ctx.accounts.vault;
        vault.total_deposited = vault
            .total_deposited
            .checked_add(amount)
            .ok_or(SpotrError::Overflow)?;

        let deposit_record = &mut ctx.accounts.deposit_record;
        deposit_record.user = ctx.accounts.fan.key();
        deposit_record.vault = vault.key();
        deposit_record.session_id = vault.session_id;
        deposit_record.amount_deposited = amount;
        deposit_record.deposited_at = Clock::get()?.unix_timestamp;
        deposit_record.bump = ctx.bumps.deposit_record;

        Ok(())
    }

    /// Admin recovers remaining USDC and closes the vault.
    pub fn close_vault(ctx: Context<CloseVault>) -> Result<()> {
        let vault = &ctx.accounts.vault;
        let session_bytes = vault.session_id.to_le_bytes();
        let bump = &[vault.bump];
        let seeds: &[&[u8]] = &[b"vault", session_bytes.as_ref(), bump];
        let signer_seeds = &[seeds];

        // Transfer any remaining USDC back to admin
        let remaining = ctx.accounts.vault_token_account.amount;
        if remaining > 0 {
            transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault_token_account.to_account_info(),
                        to: ctx.accounts.admin_token_account.to_account_info(),
                        authority: ctx.accounts.vault.to_account_info(),
                    },
                    signer_seeds,
                ),
                remaining,
            )?;
        }

        // Close the vault token account, return rent to admin
        close_token_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            CloseTokenAccount {
                account: ctx.accounts.vault_token_account.to_account_info(),
                destination: ctx.accounts.admin.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            signer_seeds,
        ))?;

        Ok(())
    }

    /// Fan requests VRF raffle to determine reward amount.
    /// Admin co-signs to attest the fan's tier.
    /// In production, triggers VRF oracle; in testing, callback is called directly.
    pub fn request_raffle(ctx: Context<RequestRaffle>, tier: u8) -> Result<()> {
        require!(tier <= 2, SpotrError::Unauthorized);

        let raffle = &mut ctx.accounts.raffle_record;
        raffle.fan = ctx.accounts.fan.key();
        raffle.vault = ctx.accounts.vault.key();
        raffle.session_id = ctx.accounts.vault.session_id;
        raffle.tier = tier;
        raffle.reward_amount = 0;
        raffle.resolved = false;
        raffle.bump = ctx.bumps.raffle_record;

        #[cfg(not(feature = "testing"))]
        {
            use anchor_lang::solana_program::program::invoke_signed;
            use ephemeral_vrf_sdk::consts::IDENTITY;
            use ephemeral_vrf_sdk::instructions::{
                create_request_randomness_ix, RequestRandomnessParams,
            };
            use ephemeral_vrf_sdk::types::SerializableAccountMeta;

            // Fan pubkey is already 32 bytes — unique per fan
            let caller_seed = ctx.accounts.fan.key().to_bytes();

            // Anchor instruction discriminator for callback_raffle
            let callback_disc = <crate::instruction::CallbackRaffle as anchor_lang::Discriminator>::DISCRIMINATOR.to_vec();

            let ix = create_request_randomness_ix(RequestRandomnessParams {
                payer: ctx.accounts.fan.key(),
                oracle_queue: ctx.accounts.oracle_queue.key(),
                callback_program_id: crate::ID,
                callback_discriminator: callback_disc,
                caller_seed,
                accounts_metas: Some(vec![SerializableAccountMeta {
                    pubkey: ctx.accounts.raffle_record.key(),
                    is_signer: false,
                    is_writable: true,
                }]),
                ..Default::default()
            });

            let (_, identity_bump) = Pubkey::find_program_address(
                &[IDENTITY],
                ctx.program_id,
            );

            invoke_signed(
                &ix,
                &[
                    ctx.accounts.fan.to_account_info(),
                    ctx.accounts.program_identity.to_account_info(),
                    ctx.accounts.oracle_queue.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                    ctx.accounts.slot_hashes.to_account_info(),
                ],
                &[&[IDENTITY, &[identity_bump]]],
            )?;
        }

        Ok(())
    }

    /// VRF oracle callback — resolves the raffle reward amount.
    /// In testing mode, admin calls this directly.
    pub fn callback_raffle(ctx: Context<CallbackRaffle>, randomness: [u8; 32]) -> Result<()> {
        #[cfg(not(feature = "testing"))]
        require!(
            ctx.accounts.vrf_program_identity.key()
                == ephemeral_vrf_sdk::consts::VRF_PROGRAM_IDENTITY,
            SpotrError::Unauthorized
        );

        let raffle = &mut ctx.accounts.raffle_record;
        require!(!raffle.resolved, SpotrError::AlreadyResolved);

        let high_payout = randomness[0] < 26; // ~10.2% chance

        raffle.reward_amount = match raffle.tier {
            2 => {
                if high_payout {
                    3_500_000
                } else {
                    1_750_000
                }
            } // Gold
            1 => {
                if high_payout {
                    1_750_000
                } else {
                    0
                }
            } // Base
            _ => 0, // Participation
        };
        raffle.resolved = true;

        Ok(())
    }

    /// Fan claims USDC based on VRF-resolved raffle result.
    /// Reads reward_amount from RaffleRecord — no amount parameter.
    pub fn claim_with_raffle(ctx: Context<ClaimWithRaffle>) -> Result<()> {
        let amount = ctx.accounts.raffle_record.reward_amount;
        require!(amount > 0, SpotrError::ZeroAmount);

        // ---- Verify the NFT asset via raw byte parsing ----
        let nft_data = ctx.accounts.nft_asset.try_borrow_data()?;
        require!(nft_data.len() >= 66, SpotrError::InvalidNftAccount);
        require!(
            nft_data[0] == MPL_CORE_KEY_ASSET,
            SpotrError::InvalidNftAccount
        );
        let nft_owner = Pubkey::try_from(&nft_data[1..33])
            .map_err(|_| error!(SpotrError::InvalidNftAccount))?;
        require!(
            nft_owner == ctx.accounts.fan.key(),
            SpotrError::NftOwnerMismatch
        );
        require!(
            nft_data[33] == MPL_CORE_UA_TYPE_ADDRESS,
            SpotrError::InvalidNftAuthority
        );
        let nft_authority = Pubkey::try_from(&nft_data[34..66])
            .map_err(|_| error!(SpotrError::InvalidNftAccount))?;
        require!(
            nft_authority == ctx.accounts.admin.key(),
            SpotrError::InvalidNftAuthority
        );
        drop(nft_data);

        // ---- Vault claim logic ----
        let vault = &ctx.accounts.vault;
        let available = vault
            .total_deposited
            .checked_sub(vault.total_claimed)
            .ok_or(SpotrError::Overflow)?;
        require!(amount <= available, SpotrError::InsufficientFunds);

        let session_bytes = vault.session_id.to_le_bytes();
        let bump = &[vault.bump];
        let seeds: &[&[u8]] = &[b"vault", session_bytes.as_ref(), bump];
        let signer_seeds = &[seeds];

        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.fan_token_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        let vault = &mut ctx.accounts.vault;
        vault.total_claimed = vault
            .total_claimed
            .checked_add(amount)
            .ok_or(SpotrError::Overflow)?;

        let claim_record = &mut ctx.accounts.claim_record;
        claim_record.user = ctx.accounts.fan.key();
        claim_record.vault = vault.key();
        claim_record.amount = amount;
        claim_record.claimed_at = Clock::get()?.unix_timestamp;
        claim_record.bump = ctx.bumps.claim_record;

        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Accounts structs
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(session_id: u64)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + Vault::INIT_SPACE,
        seeds = [b"vault", session_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub vault: Account<'info, Vault>,

    /// The vault's associated token account, owned by the vault PDA.
    #[account(
        init,
        payer = admin,
        associated_token::mint = usdc_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        has_one = admin @ SpotrError::Unauthorized,
        seeds = [b"vault", vault.session_id.to_le_bytes().as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        associated_token::mint = vault.usdc_mint,
        associated_token::authority = admin,
    )]
    pub admin_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = vault.usdc_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    /// Admin co-signs to authorize the claim amount.
    #[account(mut)]
    pub admin: Signer<'info>,

    /// The user receiving the USDC.
    pub user: Signer<'info>,

    #[account(
        mut,
        has_one = admin @ SpotrError::Unauthorized,
        seeds = [b"vault", vault.session_id.to_le_bytes().as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = admin,
        space = 8 + ClaimRecord::INIT_SPACE,
        seeds = [b"claim", vault.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub claim_record: Account<'info, ClaimRecord>,

    #[account(
        mut,
        associated_token::mint = vault.usdc_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// User's associated token account — init_if_needed so first-time users don't need to pre-create.
    #[account(
        init_if_needed,
        payer = admin,
        associated_token::mint = usdc_mint,
        associated_token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        constraint = usdc_mint.key() == vault.usdc_mint @ SpotrError::Unauthorized,
    )]
    pub usdc_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct ClaimWithNft<'info> {
    /// Admin co-signs to authorize the claim and attest NFT is revealed + frozen.
    #[account(mut)]
    pub admin: Signer<'info>,

    /// The user receiving the USDC (must also be the NFT owner).
    pub user: Signer<'info>,

    #[account(
        mut,
        has_one = admin @ SpotrError::Unauthorized,
        seeds = [b"vault", vault.session_id.to_le_bytes().as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = admin,
        space = 8 + ClaimRecord::INIT_SPACE,
        seeds = [b"claim", vault.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub claim_record: Account<'info, ClaimRecord>,

    #[account(
        mut,
        associated_token::mint = vault.usdc_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// User's associated token account — init_if_needed so first-time users don't need to pre-create.
    #[account(
        init_if_needed,
        payer = admin,
        associated_token::mint = usdc_mint,
        associated_token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        constraint = usdc_mint.key() == vault.usdc_mint @ SpotrError::Unauthorized,
    )]
    pub usdc_mint: Account<'info, Mint>,

    /// CHECK: Manually verified via raw byte parsing in the instruction handler.
    /// Account owner must be the Metaplex Core program.
    #[account(constraint = nft_asset.owner == &MPL_CORE_PROGRAM_ID @ SpotrError::InvalidNftAccount)]
    pub nft_asset: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct FanDeposit<'info> {
    /// The fan paying the entry fee.
    #[account(mut)]
    pub fan: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", vault.session_id.to_le_bytes().as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,

    /// One-time deposit record per fan per vault — prevents double-entry.
    #[account(
        init,
        payer = fan,
        space = 8 + FanDepositRecord::INIT_SPACE,
        seeds = [b"deposit", vault.key().as_ref(), fan.key().as_ref()],
        bump,
    )]
    pub deposit_record: Account<'info, FanDepositRecord>,

    #[account(
        mut,
        associated_token::mint = vault.usdc_mint,
        associated_token::authority = fan,
    )]
    pub fan_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = vault.usdc_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseVault<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        has_one = admin @ SpotrError::Unauthorized,
        seeds = [b"vault", vault.session_id.to_le_bytes().as_ref()],
        bump = vault.bump,
        close = admin,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        associated_token::mint = vault.usdc_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = vault.usdc_mint,
        associated_token::authority = admin,
    )]
    pub admin_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(tier: u8)]
pub struct RequestRaffle<'info> {
    #[account(mut)]
    pub fan: Signer<'info>,

    pub admin: Signer<'info>,

    #[account(
        has_one = admin @ SpotrError::Unauthorized,
        seeds = [b"vault", vault.session_id.to_le_bytes().as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = fan,
        space = 8 + RaffleRecord::INIT_SPACE,
        seeds = [b"raffle", vault.key().as_ref(), fan.key().as_ref()],
        bump,
    )]
    pub raffle_record: Account<'info, RaffleRecord>,

    /// CHECK: Oracle queue for VRF randomness (only used in production mode)
    #[account(mut)]
    pub oracle_queue: AccountInfo<'info>,

    /// CHECK: Program identity PDA for VRF signing (only used in production mode)
    pub program_identity: AccountInfo<'info>,

    /// CHECK: Slot hashes sysvar (only used in production mode)
    pub slot_hashes: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CallbackRaffle<'info> {
    /// VRF oracle identity signer. In testing mode, admin acts as oracle.
    pub vrf_program_identity: Signer<'info>,

    #[account(
        mut,
        seeds = [b"raffle", raffle_record.vault.as_ref(), raffle_record.fan.as_ref()],
        bump = raffle_record.bump,
    )]
    pub raffle_record: Account<'info, RaffleRecord>,
}

#[derive(Accounts)]
pub struct ClaimWithRaffle<'info> {
    /// Admin co-signs to authorize the claim.
    #[account(mut)]
    pub admin: Signer<'info>,

    /// The fan receiving the USDC (must also own the NFT).
    pub fan: Signer<'info>,

    #[account(
        mut,
        has_one = admin @ SpotrError::Unauthorized,
        seeds = [b"vault", vault.session_id.to_le_bytes().as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        seeds = [b"raffle", vault.key().as_ref(), fan.key().as_ref()],
        bump = raffle_record.bump,
        constraint = raffle_record.fan == fan.key() @ SpotrError::Unauthorized,
        constraint = raffle_record.resolved @ SpotrError::RaffleNotResolved,
    )]
    pub raffle_record: Account<'info, RaffleRecord>,

    #[account(
        init,
        payer = admin,
        space = 8 + ClaimRecord::INIT_SPACE,
        seeds = [b"claim", vault.key().as_ref(), fan.key().as_ref()],
        bump,
    )]
    pub claim_record: Account<'info, ClaimRecord>,

    #[account(
        mut,
        associated_token::mint = vault.usdc_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// Fan's associated token account — init_if_needed so first-time users don't need to pre-create.
    #[account(
        init_if_needed,
        payer = admin,
        associated_token::mint = usdc_mint,
        associated_token::authority = fan,
    )]
    pub fan_token_account: Account<'info, TokenAccount>,

    #[account(
        constraint = usdc_mint.key() == vault.usdc_mint @ SpotrError::Unauthorized,
    )]
    pub usdc_mint: Account<'info, Mint>,

    /// CHECK: Manually verified via raw byte parsing in the instruction handler.
    #[account(constraint = nft_asset.owner == &MPL_CORE_PROGRAM_ID @ SpotrError::InvalidNftAccount)]
    pub nft_asset: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub admin: Pubkey,       // 32
    pub usdc_mint: Pubkey,   // 32
    pub session_id: u64,     // 8
    pub total_deposited: u64, // 8
    pub total_claimed: u64,  // 8
    pub bump: u8,            // 1
}

#[account]
#[derive(InitSpace)]
pub struct ClaimRecord {
    pub user: Pubkey,   // 32
    pub vault: Pubkey,  // 32
    pub amount: u64,    // 8
    pub claimed_at: i64, // 8
    pub bump: u8,       // 1
}

#[account]
#[derive(InitSpace)]
pub struct FanDepositRecord {
    pub user: Pubkey,           // 32
    pub vault: Pubkey,          // 32
    pub session_id: u64,        // 8
    pub amount_deposited: u64,  // 8
    pub deposited_at: i64,      // 8
    pub bump: u8,               // 1
}

#[account]
#[derive(InitSpace)]
pub struct RaffleRecord {
    pub fan: Pubkey,         // 32
    pub vault: Pubkey,       // 32
    pub session_id: u64,     // 8
    pub tier: u8,            // 1
    pub reward_amount: u64,  // 8
    pub resolved: bool,      // 1
    pub bump: u8,            // 1
}
// INIT_SPACE = 83; total space = 8 + 83 = 91

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum SpotrError {
    #[msg("Unauthorized: signer is not the vault admin")]
    Unauthorized,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Insufficient funds in vault")]
    InsufficientFunds,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Invalid NFT account: not a valid Metaplex Core asset")]
    InvalidNftAccount,
    #[msg("NFT owner does not match the claiming user")]
    NftOwnerMismatch,
    #[msg("NFT update authority does not match the vault admin")]
    InvalidNftAuthority,
    #[msg("Raffle has not been resolved yet")]
    RaffleNotResolved,
    #[msg("Raffle has already been resolved")]
    AlreadyResolved,
}
