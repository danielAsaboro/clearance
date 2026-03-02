import { Resend } from "resend";
import { campaignConfig } from "@/lib/campaign-config";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const from = process.env.RESEND_FROM_EMAIL ?? "The Clearance <noreply@theclearance.ng>";
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://theclearance.ng";

export async function sendSessionReminder(
  to: string,
  title: string,
  scheduledAt: Date,
  week: number
): Promise<boolean> {
  try {
    const time = scheduledAt.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });

    await getResend().emails.send({
      from,
      to,
      subject: `${title} is coming up — Week ${week}`,
      html: `
        <div style="background:#000;color:#fff;font-family:Inter,Arial,sans-serif;padding:40px 24px;max-width:480px;margin:0 auto;">
          <div style="text-align:center;margin-bottom:32px;">
            <div style="display:inline-block;width:48px;height:48px;background:#F5E642;border-radius:50%;line-height:48px;font-size:24px;color:#000;font-weight:bold;">C</div>
          </div>
          <h1 style="font-size:22px;margin:0 0 8px;text-align:center;">Live Session Reminder</h1>
          <p style="color:#888;text-align:center;margin:0 0 32px;font-size:14px;">Week ${week}</p>
          <div style="background:#1A1A1A;border-radius:16px;padding:24px;margin-bottom:24px;">
            <p style="color:#F5E642;font-size:18px;font-weight:bold;margin:0 0 8px;">${title}</p>
            <p style="color:#ccc;font-size:14px;margin:0;">${time}</p>
          </div>
          <p style="color:#888;font-size:14px;line-height:1.6;margin:0 0 24px;">
            Get ready to predict trending content and earn rewards. Make sure you're online when the session starts!
          </p>
          <div style="text-align:center;">
            <a href="${appUrl}/arena" style="display:inline-block;background:#F5E642;color:#000;font-weight:bold;padding:14px 32px;border-radius:12px;text-decoration:none;font-size:14px;">Open Arena</a>
          </div>
          <p style="color:#555;font-size:12px;text-align:center;margin-top:32px;">The Clearance</p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error("Failed to send session reminder:", err);
    return false;
  }
}

export async function sendResultsReady(
  to: string,
  title: string,
  week: number,
  correctVotes: number,
  tier: string,
  rewardAmount: number,
  totalRounds: number = campaignConfig.videosPerLiveSession
): Promise<boolean> {
  try {
    const tierLabel = tier === "gold" ? "Gold" : tier === "base" ? "Base" : "Participation";
    const tierColor = tier === "gold" ? "#FACC15" : tier === "base" ? "#F5E642" : "#888";

    await getResend().emails.send({
      from,
      to,
      subject: `Your results are in — ${title}`,
      html: `
        <div style="background:#000;color:#fff;font-family:Inter,Arial,sans-serif;padding:40px 24px;max-width:480px;margin:0 auto;">
          <div style="text-align:center;margin-bottom:32px;">
            <div style="display:inline-block;width:48px;height:48px;background:#F5E642;border-radius:50%;line-height:48px;font-size:24px;color:#000;font-weight:bold;">C</div>
          </div>
          <h1 style="font-size:22px;margin:0 0 8px;text-align:center;">Session Results</h1>
          <p style="color:#888;text-align:center;margin:0 0 32px;font-size:14px;">${title} — Week ${week}</p>
          <div style="background:#1A1A1A;border-radius:16px;padding:24px;margin-bottom:24px;text-align:center;">
            <p style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Correct Votes</p>
            <p style="color:#F5E642;font-size:36px;font-weight:bold;margin:0 0 16px;">${correctVotes}/${totalRounds}</p>
            <div style="display:inline-block;background:${tierColor}20;border:1px solid ${tierColor}50;border-radius:8px;padding:8px 16px;">
              <span style="color:${tierColor};font-weight:bold;font-size:14px;">${tierLabel} Tier</span>
            </div>
          </div>
          ${rewardAmount > 0 ? `
          <div style="background:#1A1A1A;border-radius:16px;padding:24px;margin-bottom:24px;text-align:center;">
            <p style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Reward</p>
            <p style="color:#F5E642;font-size:28px;font-weight:bold;margin:0;">$${rewardAmount.toFixed(2)} USDC</p>
          </div>
          ` : ""}
          <div style="text-align:center;">
            <a href="${appUrl}/rewards" style="display:inline-block;background:#F5E642;color:#000;font-weight:bold;padding:14px 32px;border-radius:12px;text-decoration:none;font-size:14px;">View Rewards</a>
          </div>
          <p style="color:#555;font-size:12px;text-align:center;margin-top:32px;">The Clearance</p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error("Failed to send results email:", err);
    return false;
  }
}
