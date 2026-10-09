# Transportes Toto — Gestión de viajes y facturación

Aplicación web (responsive, en español) para que el equipo de logística registre los viajes con la menor cantidad de datos posible. El sistema toma la tarifa vigente del cliente, calcula kilos e importe, y genera informes y exportaciones a Excel. Reemplaza la planilla `Listado de viajes.xlsx` que se usa hoy.

## Contenido

1. [Arquitectura](#arquitectura)
2. [Estructura del proyecto](#estructura-del-proyecto)
3. [Instalación](#instalación)
4. [Migraciones y datos iniciales](#migraciones-y-datos-iniciales)
5. [Crear el primer administrador](#crear-el-primer-administrador)
6. [Pruebas](#pruebas)
7. [Docker](#docker)
8. [Roles y permisos](#roles-y-permisos)
9. [Reglas de cálculo](#reglas-de-cálculo)
10. [Decisiones técnicas y supuestos](#decisiones-técnicas-y-supuestos)
11. [Diferencias con el Excel actual y pendientes](#diferencias-con-el-excel-actual-y-pendientes)

## Arquitectura

| Capa | Tecnología | Motivo |
|---|---|---|
| Frontend y backend | **Next.js 15** (App Router) + **TypeScript** | Un solo proyecto y un solo despliegue. Las rutas `/api/*` exponen el backend. |
| Base de datos | **PostgreSQL 16** | Relacional, con tipos `numeric` exactos y restricciones `CHECK`. |
| ORM y migraciones | **Prisma 6** | Migraciones versionadas en `prisma/migrations`. |
| Validación | **Zod** | Mismos esquemas en las rutas, con mensajes en español. |
| Estilos | **Tailwind CSS 4** | Diseño pensado primero para el celular. |
| Componentes accesibles | **Headless UI** | Lista desplegable con buscador y diálogos accesibles con teclado. |
| Excel | **ExcelJS** | Genera `.xlsx` con celdas numéricas y de fecha reales. |
| Pruebas | **Vitest** (unitarias e integración contra PostgreSQL) + **Playwright** (navegador móvil) | |

La aplicación está organizada en tres capas separadas:

- **Dominio** (`src/lib/domain`): funciones puras sin acceso a base de datos. Incluyen los cálculos, la selección de tarifas y la aritmética decimal. El navegador las usa para mostrar el cálculo en tiempo real y el servidor para el cálculo oficial. Por eso ambos dan exactamente el mismo resultado.
- **Servicios** (`src/server/servicios`): reglas de negocio, transacciones y **autorización**. Cada operación verifica permisos acá, no sólo en la interfaz.
- **Interfaz** (`src/app`, `src/components`): páginas que consumen la API.

## Estructura del proyecto

```
prisma/
  schema.prisma           Modelo de datos
  migrations/             Migraciones SQL (incluye restricciones CHECK)
  seed.ts                 Datos iniciales: roles, 4 clientes y configuración (sin tarifas)
  demo.ts                 Datos ficticios de demostración
scripts/crear-admin.ts    Alta del primer administrador
src/
  lib/domain/             Cálculos, tarifas, aritmética decimal, tipos (puro, compartido)
  lib/permisos.ts         Matriz de permisos por rol (única fuente de verdad)
  lib/validacion.ts       Esquemas Zod comunes y mensajes en español
  server/
    auth/                 Hash de contraseñas (scrypt), sesiones
    servicios/            viajes, tarifas, catálogos, usuarios, informes, panel, importación
    excel.ts              Exportación de viajes e informes; plantilla e importación de tarifas
    http.ts               Envoltorio de rutas: sesión, permisos, CSRF, errores en español
  app/
    (auth)/               Login, restablecer y cambiar contraseña
    (app)/                Panel, viajes, tarifario, catálogos, usuarios, informes, configuración
    api/                  API REST
  components/             Componentes de interfaz
tests/
  unit/                   Reglas de cálculo y de selección de tarifas
  integration/            Flujos completos contra PostgreSQL y rutas HTTP reales
  e2e/                    Navegador móvil (Playwright)
```

## Instalación

Requisitos: Node.js 22 y PostgreSQL 16 (local o con Docker).

```bash
npm install
cp .env.example .env          # complete DATABASE_URL y TEST_DATABASE_URL
```

Si no tiene PostgreSQL instalado, puede levantar sólo la base con Docker:

```bash
POSTGRES_PASSWORD=una-clave docker compose up -d db
```

Esto crea las bases `toto` y `toto_test`.

Después:

```bash
npm run db:migrate            # aplica las migraciones
npm run db:seed               # roles, clientes iniciales y configuración
npm run crear-admin -- --usuario admin --nombre "Nombre Apellido"
npm run dev                   # http://localhost:3000
```

Opcionalmente, para cargar datos ficticios de demostración (sólo desarrollo):

```bash
npm run db:demo
```

Crea los usuarios `demo.admin`, `demo.logistica` y `demo.consulta`, todos con la contraseña `Demo2026toto`. También crea dos clientes demo con tarifas inventadas y unos 30 viajes.

## Migraciones y datos iniciales

| Comando | Uso |
|---|---|
| `npm run db:migrate` | Aplica las migraciones pendientes (`prisma migrate deploy`). Para producción. |
| `npm run db:migrate:dev -- --name descripcion` | Crea una nueva migración tras cambiar `schema.prisma`. |
| `npm run db:seed` | Datos iniciales. Es idempotente, así que puede ejecutarse varias veces. |

Los datos iniciales cargan los clientes **Paycueros SA, SAMIFRUIT, CARGILL SA y GRANICOR** **sin tarifas**. Las tarifas reales quedan *pendientes de configuración*: el panel y el tarifario muestran el aviso hasta que se carguen. Para cargarlas:

- **Tarifario → Cargar desde Excel**: se descarga una plantilla con una fila por cliente y el importe vacío. Se completa y se sube. La importación es *todo o nada* e informa los errores fila por fila.
- **Tarifario → Nueva tarifa**: alta manual.

## Crear el primer administrador

```bash
npm run crear-admin -- --usuario admin --nombre "Nombre Apellido" --email correo@dominio
```

La contraseña se pide por consola, así que no queda en el historial. También puede pasarse en la variable `ADMIN_CLAVE`. El administrador debe cambiarla en el primer ingreso. El mismo comando sirve para recuperar el acceso si se pierde la contraseña del administrador.

**Recuperar una contraseña:** un administrador entra en *Usuarios → Enlace para restablecer contraseña* y genera un enlace de un solo uso, válido por 60 minutos, que entrega al usuario. No hay envío de correo configurado (ver supuestos). Cada usuario puede cambiar su contraseña en *Mi cuenta*.

## Pruebas

```bash
npm run typecheck             # TypeScript
npm run lint                  # ESLint
npm test                      # unitarias + integración (usa TEST_DATABASE_URL; aplica migraciones solo)
npm run build && npm run test:e2e   # navegador móvil con Playwright (usa la base de pruebas)
```

> Las pruebas de integración y e2e **vacían** la base indicada en `TEST_DATABASE_URL`. Nunca apunte esa variable a la base real.

Cobertura de los criterios de aceptación:

| # | Criterio | Prueba |
|---|---|---|
| 1 | Logística crea un viaje | `integration/viajes.test.ts`, `integration/http-exportacion.test.ts` |
| 2 | Tarifa vigente al elegir cliente | `integration/viajes.test.ts` (2) |
| 3 | Promedio de peso | `unit/calculos.test.ts` |
| 4 | Facturación fija | `unit/calculos.test.ts`, `integration/viajes.test.ts` (4) |
| 5 | Facturación por kg | `unit/calculos.test.ts`, `integration/viajes.test.ts` (5) |
| 6 | Cambiar el tarifario no altera un viaje cerrado | `integration/viajes.test.ts` (6) |
| 7 | No se cierra sin tarifa vigente | `integration/viajes.test.ts` (7) |
| 8 | Vigencias incompatibles | `unit/tarifas.test.ts`, `integration/viajes.test.ts` (8), `integration/tarifario-catalogos.test.ts` |
| 9 | Permisos | `integration/viajes.test.ts` (9), rutas HTTP en `integration/http-exportacion.test.ts` |
| 10 | La exportación respeta los filtros | `integration/http-exportacion.test.ts` (10) |
| 11 | Números exportados como números | `integration/http-exportacion.test.ts` (11) |
| 12 | Formulario en pantalla móvil | `e2e/viaje-movil.spec.ts` (12) |
| 13 | Sin duplicados por doble envío | `integration/viajes.test.ts` (13), `e2e/viaje-movil.spec.ts` (13) |
| 14 | Auditoría de viajes cerrados | `integration/viajes.test.ts` (14) |

Si su versión de Playwright no encuentra Chromium, defina `PLAYWRIGHT_CHROMIUM_PATH` con la ruta del ejecutable.

## Docker

```bash
POSTGRES_PASSWORD=una-clave docker compose up -d --build
docker compose exec app npx tsx scripts/crear-admin.ts --usuario admin --nombre "Nombre"
```

Al arrancar, el contenedor aplica las migraciones y los datos iniciales. En producción, detrás de HTTPS, defina `COOKIE_SECURE=true` y `APP_URL` con la URL pública.

## Roles y permisos

La matriz está en `src/lib/permisos.ts`. El backend la aplica en cada servicio; la interfaz sólo la usa para ocultar opciones.

| Acción | Administrador | Logística | Consulta / administración |
|---|:-:|:-:|:-:|
| Usuarios, catálogos, configuración | ✔ | | |
| Crear y editar tarifas | ✔ | | |
| Ver tarifario y simulador | ✔ | ✔ | ✔ |
| Registrar viajes, editar abiertos, cerrar | ✔ | ✔ | |
| Editar viajes cerrados o facturados (con motivo) | ✔ | | |
| Reabrir, marcar facturado, anular | ✔ | | |
| Ver viajes en borrador y abiertos | ✔ | ✔ | |
| Ver viajes cerrados y facturados | ✔ | ✔ | ✔ |
| Informes operativos (kilos, viajes, diferencias) | ✔ | ✔ | ✔ |
| Importes en informes | ✔ | | ✔ |
| Exportar a Excel | ✔ | sólo con permiso | ✔ |

## Reglas de cálculo

- `promedioKg = (kgSalida + kgLlegada) / 2`
- `diferenciaKg = kgSalida − kgLlegada`
- `porcentajeDiferencia = diferenciaKg / kgSalida × 100`. Si `kgSalida` es 0, no se calcula (no hay división por cero).
- **Tarifa fija:** `importe = tarifa`.
- **Tarifa por peso:** `importe = kgBase × tarifa`, dividido entre 1.000 si la tarifa es **por tonelada**.
- `kgBase` se configura en cada tarifa: salida, llegada, promedio, mayor, menor, o *promedio, o la medición disponible si falta una*.
- Kilos e importes se redondean a 2 decimales con redondeo comercial. El importe se calcula sobre los kilos ya redondeados. Las tarifas admiten 4 decimales.
- Toda la aritmética es decimal exacta (`BigInt` en la aplicación, `numeric` en PostgreSQL). No se usan números de coma flotante.
- Entrada de números en formato uruguayo: `28410,5` o `1.234,56`. Además, `30.000` se interpreta como treinta mil.
- **Alerta de diferencia:** si `|porcentajeDiferencia|` supera el umbral (2 % por defecto), se muestra una advertencia y se exige una observación para cerrar. Bloquear el cierre es opcional. Todo esto se modifica en *Configuración*.
- **Selección de tarifa:**
  1. Cliente + origen + destino + carga
  2. Cliente + origen + destino
  3. Cliente + carga
  4. Cliente

  Si hay dos tarifas en el mismo nivel, el sistema **no elige**: informa un error de configuración y el viaje no puede cerrarse. Además, al guardar una tarifa se rechazan las vigencias superpuestas de la misma combinación.
- **Al cerrar** un viaje se copia la tarifa aplicada dentro del viaje (modalidad, importe, unidad, base, vigencia y una copia JSON completa). Cambios posteriores del tarifario no lo afectan. Si un administrador edita un viaje cerrado, se recalcula con esa tarifa congelada, salvo que marque explícitamente *reaplicar tarifa vigente*.

## Decisiones técnicas y supuestos

1. **Tarifas por tonelada.** El Excel actual calcula `kg / 1000 × tarifa`. Por eso las tarifas por peso tienen una *unidad*: por kg o por tonelada.
2. **Base "promedio o medición disponible".** En el Excel se factura con el promedio cuando hay dos pesadas y con la única disponible cuando falta una. Se agregó esta base además de las cinco pedidas.
3. **Kilos obligatorios al cerrar:** sólo los que necesita la base de la tarifa. Los viajes de tarifa fija pueden no tener kilos, como ocurre en el Excel. Para exigir siempre ambos pesos, active *Exigir kg de salida y de llegada* en Configuración.
4. **Estados:**
   - *Borrador*: datos incompletos.
   - *Abierto*: datos operativos completos.
   - *Cerrado*: tarifa congelada.
   - *Facturado*: sólo desde cerrado.
   - *Anulado*: con motivo; no se elimina nada.

   Sólo el administrador marca como facturado. Si el área administrativa debe hacerlo, alcanza con agregar el rol en `viajes.facturar`.
5. **Carga:** se elige un *tipo de carga* del catálogo (lo usan las tarifas y los informes) y opcionalmente se escribe un *detalle* libre, por ejemplo "Sal/C frescos". En la lista desplegable se puede escribir un texto que no existe y queda como detalle.
6. **Lugares:** un único catálogo con las marcas *de carga* y *de descarga*, porque en el Excel el mismo lugar aparece como origen y como destino (por ejemplo, Paycueros).
7. **Moneda:** se guarda el código ISO en cada tarifa y viaje (UYU por defecto; también USD). Los informes y totales se separan por moneda. No hay conversión de tipo de cambio.
8. **Sesiones** propias en base de datos. La cookie es `httpOnly` y `SameSite=Lax`, y se guarda el hash SHA-256 del token. Las contraseñas usan **scrypt**. El usuario se bloquea 15 minutos tras 5 intentos fallidos. Las mutaciones verifican el encabezado `Origin` (CSRF). Las consultas están parametrizadas (Prisma o SQL con parámetros).
9. **Recuperación de contraseña** con un enlace de un solo uso que genera el administrador. No se configuró correo saliente (SMTP) para no agregar infraestructura. Si se quiere envío por correo, se puede agregar sobre `generarTokenRestablecimiento`.
10. **Concurrencia:** viajes y tarifas tienen un campo `version` (bloqueo optimista). Las altas de tarifas de un mismo cliente se serializan con un *advisory lock* de PostgreSQL. La doble pulsación se evita con una clave de idempotencia por formulario y con botones que se deshabilitan mientras se envía.
11. **Fechas:** la fecha del viaje y las vigencias son `DATE`; las marcas de auditoría son `timestamptz` en UTC. La interfaz muestra la hora de `America/Montevideo`, y "hoy" se calcula con esa zona horaria.
12. **Catálogos:** el borrado físico sólo se permite si el registro no tiene viajes ni tarifas. Las claves foráneas son `RESTRICT`. En los demás casos se desactiva, y un registro desactivado no puede asignarse a viajes nuevos.
13. **Choferes:** sólo se guarda nombre y teléfono opcional; no se guardan documentos personales.
14. **SAMIFRUIT** se supone equivalente al cliente "San Miguel" del Excel *(supuesto; no confirmado)*.

## Diferencias con el Excel actual y pendientes

La planilla tiene columnas que no estaban en el pedido. Se incorporaron como **datos opcionales** (bajo "Más datos", para no alargar la carga mínima):

- Nro. de orden
- Nro. de pesada
- Viáticos
- Estadías
- Liquidación del cliente (con la diferencia contra el importe calculado)
- Nro. y fecha de factura

**No** se implementaron estas columnas del Excel:

- *KMTS*
- *Comisión chofer* (8 %)
- *Facturación USD*
- *Fecha de envío*
- *Nro. de pre-liquidación*
- *Fecha de cobro*

Tampoco se importó el historial de viajes de la planilla. Esos datos tienen nombres de clientes en columnas corridas y nombres reales de personas, y requieren una limpieza que conviene hacer con el responsable de operaciones.

Las tarifas que figuran en la hoja *Tarifas* del Excel **no se cargaron automáticamente**. Están organizadas por códigos internos (TN16, TR003, VAC…) cuyo significado no está documentado. Deben cargarse con la plantilla una vez validadas.
