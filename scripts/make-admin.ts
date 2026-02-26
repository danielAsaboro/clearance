/**
 * Usage: npx tsx scripts/make-admin.ts <email>
 * Example: npx tsx scripts/make-admin.ts asaborodaniel@gmail.com
 */
import { prisma } from "../src/lib/db";

async function main() {
    const email = process.argv[2];
    if (!email) {
        console.error("Usage: npx tsx scripts/make-admin.ts <email>");
        process.exit(1);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        console.error(`No user found with email: ${email}`);
        process.exit(1);
    }

    const updated = await prisma.user.update({
        where: { email },
        data: { role: "admin" },
    });

    console.log(`✅ Successfully promoted ${updated.email} to admin.`);
    console.log(`   ID: ${updated.id}`);
    console.log(`   DisplayName: ${updated.displayName}`);
    console.log(`   Role: ${updated.role}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
