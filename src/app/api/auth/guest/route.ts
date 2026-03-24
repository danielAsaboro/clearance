import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db";
import { generateGuestUsername, signGuestToken } from "@/lib/guest-auth";

// POST /api/auth/guest — Create a guest user with auto-generated username
export async function POST() {
  const displayName = generateGuestUsername();
  const guestPrivyId = `guest_${nanoid(12)}`;
  const referralCode = nanoid(8).toUpperCase();

  const user = await prisma.user.create({
    data: {
      privyId: guestPrivyId,
      displayName,
      referralCode,
      isGuest: true,
    },
  });

  const guestToken = signGuestToken(user.id);

  return NextResponse.json({
    guestToken,
    displayName: user.displayName,
    userId: user.id,
  });
}
