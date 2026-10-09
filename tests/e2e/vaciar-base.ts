import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const tablas = ["TripAuditLog", "Trip", "TariffAuditLog", "Tariff", "Session", "PasswordResetToken", "User", "Client", "Driver", "Vehicle", "CargoType", "Location", "Setting", "Role"];

if (!process.env.DATABASE_URL?.includes("test")) {
  console.error("Por seguridad sólo se vacían bases cuyo nombre contenga 'test'.");
  process.exit(1);
}
prisma
  .$executeRawUnsafe(`TRUNCATE ${tablas.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`)
  .finally(() => prisma.$disconnect());
