#![allow(clippy::result_large_err)]

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
pub mod clearance {
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
        require!(amount > 0, ClearanceError::ZeroAmount);

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
            .ok_or(ClearanceError::Overflow)?;

        Ok(())
    }

    /// User claims USDC from the vault. Admin co-signs to authorize the amount.
    /// A ClaimRecord PDA is created — if it already exists the tx fails (double-claim prevention).
    pub fn claim(ctx: Context<Claim>, amount: u64) -> Result<()> {
        require!(amount > 0, ClearanceError::ZeroAmount);

        let vault = &ctx.accounts.vault;
        let available = vault
            .total_deposited
            .checked_sub(vault.total_claimed)
            .ok_or(ClearanceError::Overflow)?;
        require!(amount <= available, ClearanceError::InsufficientFunds);

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
            .ok_or(ClearanceError::Overflow)?;

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
        require!(amount > 0, ClearanceError::ZeroAmount);

        // ---- Verify the NFT asset via raw byte parsing ----
        let nft_data = ctx.accounts.nft_asset.try_borrow_data()?;
        // Minimum size: 1 (key) + 32 (owner) + 1 (UA discriminator) + 32 (UA address) = 66 bytes
        require!(nft_data.len() >= 66, ClearanceError::InvalidNftAccount);
        // Byte 0: Key discriminator must be Asset (1)
        require!(nft_data[0] == MPL_CORE_KEY_ASSET, ClearanceError::InvalidNftAccount);
        // Bytes 1..33: asset owner must be the claiming user
        let nft_owner = Pubkey::try_from(&nft_data[1..33])
            .map_err(|_| error!(ClearanceError::InvalidNftAccount))?;
        require!(nft_owner == ctx.accounts.user.key(), ClearanceError::NftOwnerMismatch);
        // Byte 33: UpdateAuthority discriminator must be Address (1)
        require!(nft_data[33] == MPL_CORE_UA_TYPE_ADDRESS, ClearanceError::InvalidNftAuthority);
        // Bytes 34..66: update authority address must be the vault admin
        let nft_authority = Pubkey::try_from(&nft_data[34..66])
            .map_err(|_| error!(ClearanceError::InvalidNftAccount))?;
        require!(nft_authority == ctx.accounts.admin.key(), ClearanceError::InvalidNftAuthority);
        // Drop the borrow before CPI
        drop(nft_data);

        // ---- Same vault claim logic as `claim` ----
        let vault = &ctx.accounts.vault;
        let available = vault
            .total_deposited
            .checked_sub(vault.total_claimed)
            .ok_or(ClearanceError::Overflow)?;
        require!(amount <= available, ClearanceError::InsufficientFunds);

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
            .ok_or(ClearanceError::Overflow)?;

        let claim_record = &mut ctx.accounts.claim_record;
        claim_record.user = ctx.accounts.user.key();
        claim_record.vault = vault.key();
        claim_record.amount = amount;
        claim_record.claimed_at = Clock::get()?.unix_timestamp;
        claim_record.bump = ctx.bumps.claim_record;

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
        has_one = admin @ ClearanceError::Unauthorized,
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
        has_one = admin @ ClearanceError::Unauthorized,
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
        constraint = usdc_mint.key() == vault.usdc_mint @ ClearanceError::Unauthorized,
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
        has_one = admin @ ClearanceError::Unauthorized,
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
        constraint = usdc_mint.key() == vault.usdc_mint @ ClearanceError::Unauthorized,
    )]
    pub usdc_mint: Account<'info, Mint>,

    /// CHECK: Manually verified via raw byte parsing in the instruction handler.
    /// Account owner must be the Metaplex Core program.
    #[account(constraint = nft_asset.owner == &MPL_CORE_PROGRAM_ID @ ClearanceError::InvalidNftAccount)]
    pub nft_asset: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct CloseVault<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        has_one = admin @ ClearanceError::Unauthorized,
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

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum ClearanceError {
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
}
