import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password_hash = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@copal.app" },
    update: {},
    create: {
      email: "admin@copal.app",
      password_hash,
      role: "admin",
      timezone: "America/Santiago",
    },
  });

  console.log(`Seed complete. Admin user: ${admin.email}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
