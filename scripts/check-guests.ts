import { prisma } from "../src/lib/db";

async function main() {
  const code = await prisma.discountCode.findFirst({
    where: { code: "BCPTAMJCZU" },
    include: { user: { select: { id: true, displayName: true, role: true, isGuest: true } } },
  });
  console.log("Discount code BCPTAMJCZU:", code);

  // Check the 6/7 user - BlazeLion60 is still isGuest: true
  const blaze = await prisma.user.findFirst({
    where: { displayName: "BlazeLion60" },
    select: { id: true, displayName: true, isGuest: true, role: true, privyId: true },
  });
  console.log("\nBlazeLion60:", blaze);

  await prisma.$disconnect();
}
main();
