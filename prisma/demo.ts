/**
 * Datos ficticios de demostración. NO usar en producción.
 * Nombres, matrículas, clientes demo e importes son inventados y están marcados como "Demo".
 * Las tarifas sólo se crean para clientes demo: los clientes reales quedan pendientes de configuración.
 */
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { sembrar } from "./seed";
import { hashClave } from "../src/server/auth/clave";
import { crearTarifa, nuevaVigencia } from "../src/server/servicios/tarifas";
import { anularViaje, crearViaje, facturarViaje } from "../src/server/servicios/viajes";
import type { Actor } from "../src/lib/permisos";
import { hoyUruguay, sumarDias } from "../src/lib/fechas";

const prisma = new PrismaClient();
export const CLAVE_DEMO = "Demo2026toto";

async function usuario(usuario: string, nombre: string, rol: string, puedeExportar: boolean): Promise<Actor> {
  const r = await prisma.role.findUniqueOrThrow({ where: { codigo: rol } });
  const u = await prisma.user.upsert({
    where: { usuario },
    create: { usuario, nombre, roleId: r.id, passwordHash: await hashClave(CLAVE_DEMO), puedeExportar },
    update: {},
  });
  return { id: u.id, nombre: u.nombre, usuario: u.usuario, rol: rol as Actor["rol"], puedeExportar };
}

async function main() {
  await sembrar(prisma);
  if (await prisma.client.findUnique({ where: { nombre: "Cliente Demo Agro" } })) {
    console.log("Los datos de demostración ya estaban cargados.");
    return;
  }
  const admin = await usuario("demo.admin", "Admin Demo", "ADMIN", true);
  const logistica = await usuario("demo.logistica", "Logística Demo", "LOGISTICA", false);
  await usuario("demo.consulta", "Consulta Demo", "CONSULTA", true);

  const choferes = await Promise.all(
    ["Chofer Demo Uno", "Chofer Demo Dos", "Chofer Demo Tres", "Chofer Demo Cuatro"].map((nombre) =>
      prisma.driver.create({ data: { nombre } }),
    ),
  );
  const vehiculos = await Promise.all(
    ["DMO1001", "DMO1002", "DMO1003", "DMO1004"].map((matricula) => prisma.vehicle.create({ data: { matricula, descripcion: "Vehículo de demostración" } })),
  );
  const cargas = Object.fromEntries(
    await Promise.all(
      ["Cueros frescos", "Cueros salados", "Wet blue", "Limón", "Maíz", "Soja", "Productos químicos"].map(async (nombre) => [
        nombre,
        await prisma.cargoType.upsert({ where: { nombre }, create: { nombre }, update: {} }),
      ]),
    ),
  );
  const lugares = Object.fromEntries(
    await Promise.all(
      ["Planta Demo Norte", "Depósito Demo Sur", "Puerto de Montevideo", "Nueva Palmira", "Salto", "Paysandú", "Canelones"].map(async (nombre) => [
        nombre,
        await prisma.location.upsert({ where: { nombre }, create: { nombre }, update: {} }),
      ]),
    ),
  );

  const agro = await prisma.client.create({ data: { nombre: "Cliente Demo Agro", observaciones: "Cliente ficticio de demostración" } });
  const frigo = await prisma.client.create({ data: { nombre: "Cliente Demo Frigorífico", observaciones: "Cliente ficticio de demostración" } });
  const granicor = await prisma.client.findUniqueOrThrow({ where: { nombre: "GRANICOR" } });

  const hoy = hoyUruguay();
  const inicio = sumarDias(hoy, -120);
  const cambio = sumarDias(hoy, -30);

  const tAgro = await crearTarifa(admin, {
    clientId: agro.id, modalidad: "POR_PESO", importe: "450", moneda: "UYU", unidad: "TONELADA", baseCalculo: "PROMEDIO",
    vigenciaDesde: inicio, observaciones: "DEMO - tarifa general por tonelada",
  });
  await nuevaVigencia(admin, tAgro.id, { vigenciaDesde: cambio, importe: "468", motivo: "DEMO - ajuste de precios 4 %" });
  await crearTarifa(admin, {
    clientId: agro.id, modalidad: "POR_PESO", importe: "520", moneda: "UYU", unidad: "TONELADA", baseCalculo: "MENOR",
    origenId: lugares["Salto"].id, destinoId: lugares["Nueva Palmira"].id, vigenciaDesde: inicio, observaciones: "DEMO - ruta Salto a Nueva Palmira",
  });
  await crearTarifa(admin, {
    clientId: frigo.id, modalidad: "FIJO", importe: "18000", moneda: "UYU", vigenciaDesde: inicio, observaciones: "DEMO - viaje fijo",
  });
  await crearTarifa(admin, {
    clientId: frigo.id, modalidad: "POR_PESO", importe: "1.35", moneda: "UYU", unidad: "KG", baseCalculo: "PROMEDIO_DISPONIBLE",
    origenId: lugares["Planta Demo Norte"].id, destinoId: lugares["Depósito Demo Sur"].id, cargoTypeId: cargas["Cueros salados"].id,
    vigenciaDesde: inicio, observaciones: "DEMO - cueros salados por kg",
  });

  const plantillas = [
    { cliente: agro, carga: "Maíz", o: "Salto", d: "Nueva Palmira", kg: 30000 },
    { cliente: agro, carga: "Soja", o: "Paysandú", d: "Nueva Palmira", kg: 29000 },
    { cliente: agro, carga: "Maíz", o: "Canelones", d: "Puerto de Montevideo", kg: 28000 },
    { cliente: frigo, carga: "Cueros salados", o: "Planta Demo Norte", d: "Depósito Demo Sur", kg: 24000 },
    { cliente: frigo, carga: "Cueros frescos", o: "Canelones", d: "Planta Demo Norte", kg: 18000 },
    { cliente: frigo, carga: "Wet blue", o: "Planta Demo Norte", d: "Puerto de Montevideo", kg: 26000 },
  ];

  let n = 0;
  for (let dia = 60; dia >= 0; dia -= 2) {
    const p = plantillas[n % plantillas.length];
    const salida = p.kg + ((n * 137) % 900);
    // Cada 9 viajes se simula una merma importante para mostrar alertas.
    const llegada = n % 9 === 4 ? Math.round(salida * 0.965) : salida - ((n * 53) % 120);
    const viejo = dia > 10;
    const { viaje } = await crearViaje(logistica, {
      idempotencyKey: randomUUID(),
      accion: viejo ? "CERRAR" : n % 3 === 0 ? "BORRADOR" : "ABIERTO",
      datos: {
        fecha: sumarDias(hoy, -dia),
        vehicleId: vehiculos[n % vehiculos.length].id,
        clientId: p.cliente.id,
        driverId: choferes[n % choferes.length].id,
        cargoTypeId: cargas[p.carga].id,
        origenId: lugares[p.o].id,
        destinoId: lugares[p.d].id,
        kgSalida: String(salida),
        kgLlegada: String(llegada),
        observaciones: n % 9 === 4 ? "DEMO - merma por humedad informada por el chofer" : null,
      },
    });
    let version = viaje.version;
    if (viejo && dia > 30 && n % 2 === 0) {
      const r = await facturarViaje(admin, viaje.id, { version, numeroFactura: `DEMO-${1000 + n}`, fechaFactura: sumarDias(hoy, -dia + 5) });
      version = r.viaje.version;
    }
    if (n === 7) await anularViaje(admin, viaje.id, { version, motivo: "DEMO - viaje cargado por error" });
    n++;
  }

  // Viaje de un cliente real sin tarifa configurada (aparece en "sin tarifa").
  await crearViaje(logistica, {
    idempotencyKey: randomUUID(),
    accion: "ABIERTO",
    datos: {
      fecha: hoy,
      vehicleId: vehiculos[0].id,
      clientId: granicor.id,
      driverId: choferes[0].id,
      cargoTypeId: cargas["Soja"].id,
      origenId: lugares["Paysandú"].id,
      destinoId: lugares["Nueva Palmira"].id,
      kgSalida: "30100",
    },
  });
  console.log(`Datos de demostración cargados (${n + 1} viajes). Usuarios demo.admin / demo.logistica / demo.consulta, contraseña: ${CLAVE_DEMO}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
