import { prisma } from "../src/lib/db";

async function main() {
    const users = await prisma.user.findMany({
        select: { id: true, email: true, phone: true, role: true, displayName: true, privyId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
    });

    if (users.length === 0) {
        console.log("No users in DB yet. Have you logged in via the app at least once?");
        return;
    }

    console.log("\n=== All Users ===");
    console.table(users.map(u => ({ ...u, privyId: u.privyId.slice(0, 12) + "..." })));

    const roleCounts = await prisma.user.groupBy({ by: ["role"], _count: { id: true } });
    console.log("\n=== Role Distribution ===");
    console.table(roleCounts);
}

main().catch(console.error).finally(() => prisma.$disconnect());
