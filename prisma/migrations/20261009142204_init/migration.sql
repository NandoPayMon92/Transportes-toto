-- CreateEnum
CREATE TYPE "ModalidadFacturacion" AS ENUM ('FIJO', 'POR_PESO');

-- CreateEnum
CREATE TYPE "UnidadTarifa" AS ENUM ('KG', 'TONELADA');

-- CreateEnum
CREATE TYPE "BaseCalculo" AS ENUM ('SALIDA', 'LLEGADA', 'PROMEDIO', 'MAYOR', 'MENOR', 'PROMEDIO_DISPONIBLE');

-- CreateEnum
CREATE TYPE "EstadoViaje" AS ENUM ('BORRADOR', 'ABIERTO', 'CERRADO', 'FACTURADO', 'ANULADO');

-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "email" TEXT,
    "nombre" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "puedeExportar" BOOLEAN NOT NULL DEFAULT false,
    "debeCambiarClave" BOOLEAN NOT NULL DEFAULT false,
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rut" TEXT,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CargoType" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CargoType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "esCarga" BOOLEAN NOT NULL DEFAULT true,
    "esDescarga" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "clave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "Tariff" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "modalidad" "ModalidadFacturacion" NOT NULL,
    "importe" DECIMAL(14,4) NOT NULL,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'UYU',
    "unidad" "UnidadTarifa",
    "baseCalculo" "BaseCalculo",
    "origenId" TEXT,
    "destinoId" TEXT,
    "cargoTypeId" TEXT,
    "vigenciaDesde" DATE NOT NULL,
    "vigenciaHasta" DATE,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,
    "reemplazaAId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Tariff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TariffAuditLog" (
    "id" TEXT NOT NULL,
    "tariffId" TEXT NOT NULL,
    "userId" TEXT,
    "accion" TEXT NOT NULL,
    "motivo" TEXT,
    "cambios" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TariffAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "vehicleId" TEXT,
    "clientId" TEXT,
    "driverId" TEXT,
    "cargoTypeId" TEXT,
    "cargaDetalle" TEXT,
    "origenId" TEXT,
    "destinoId" TEXT,
    "kgSalida" DECIMAL(12,2),
    "kgLlegada" DECIMAL(12,2),
    "kgPromedio" DECIMAL(12,2),
    "kgDiferencia" DECIMAL(12,2),
    "porcentajeDiferencia" DECIMAL(7,2),
    "kgBase" DECIMAL(12,2),
    "alertaDiferencia" BOOLEAN NOT NULL DEFAULT false,
    "numeroOrden" TEXT,
    "numeroPesada" TEXT,
    "viaticos" INTEGER,
    "estadias" INTEGER,
    "liquidacionCliente" DECIMAL(14,2),
    "tariffId" TEXT,
    "tarifaModalidad" "ModalidadFacturacion",
    "tarifaImporte" DECIMAL(14,4),
    "tarifaUnidad" "UnidadTarifa",
    "tarifaBase" "BaseCalculo",
    "tarifaVigenciaDesde" DATE,
    "tarifaSnapshot" JSONB,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'UYU',
    "importeFacturado" DECIMAL(14,2),
    "estado" "EstadoViaje" NOT NULL DEFAULT 'BORRADOR',
    "observaciones" TEXT,
    "motivoAnulacion" TEXT,
    "numeroFactura" TEXT,
    "fechaFactura" DATE,
    "idempotencyKey" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "closedById" TEXT,
    "closedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripAuditLog" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "estadoAnterior" "EstadoViaje",
    "estadoNuevo" "EstadoViaje",
    "motivo" TEXT,
    "cambios" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_codigo_key" ON "Role"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "User_usuario_key" ON "User"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_nombre_key" ON "Client"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_nombre_key" ON "Driver"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_matricula_key" ON "Vehicle"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "CargoType_nombre_key" ON "CargoType"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Location_nombre_key" ON "Location"("nombre");

-- CreateIndex
CREATE INDEX "Tariff_clientId_activo_vigenciaDesde_idx" ON "Tariff"("clientId", "activo", "vigenciaDesde");

-- CreateIndex
CREATE INDEX "TariffAuditLog_tariffId_createdAt_idx" ON "TariffAuditLog"("tariffId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_numero_key" ON "Trip"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_idempotencyKey_key" ON "Trip"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Trip_fecha_idx" ON "Trip"("fecha");

-- CreateIndex
CREATE INDEX "Trip_clientId_fecha_idx" ON "Trip"("clientId", "fecha");

-- CreateIndex
CREATE INDEX "Trip_estado_fecha_idx" ON "Trip"("estado", "fecha");

-- CreateIndex
CREATE INDEX "Trip_vehicleId_fecha_idx" ON "Trip"("vehicleId", "fecha");

-- CreateIndex
CREATE INDEX "Trip_driverId_fecha_idx" ON "Trip"("driverId", "fecha");

-- CreateIndex
CREATE INDEX "TripAuditLog_tripId_createdAt_idx" ON "TripAuditLog"("tripId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_origenId_fkey" FOREIGN KEY ("origenId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_cargoTypeId_fkey" FOREIGN KEY ("cargoTypeId") REFERENCES "CargoType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffAuditLog" ADD CONSTRAINT "TariffAuditLog_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "Tariff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffAuditLog" ADD CONSTRAINT "TariffAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_cargoTypeId_fkey" FOREIGN KEY ("cargoTypeId") REFERENCES "CargoType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_origenId_fkey" FOREIGN KEY ("origenId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "Tariff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripAuditLog" ADD CONSTRAINT "TripAuditLog_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripAuditLog" ADD CONSTRAINT "TripAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
