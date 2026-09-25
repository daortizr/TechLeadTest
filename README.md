# Sistema de Reservas de Vuelos en Tiempo Real

> **Arquitectura y diagramas de flujo:** [ver documento](https://drive.google.com/file/d/17F5CZ5MybOOMOAoL97gl_TXIBxLiHFhY/view?usp=sharing)

Prueba técnica Full Stack Senior: buscar vuelos, bloquear un asiento, pagar con una tarjeta ficticia y obtener un boleto, con todos los cambios reflejados al instante en todas las pestañas abiertas.

## Características

- **Búsqueda de vuelos** por origen, destino y fecha; la lista se actualiza sola cuando un vuelo se agota o se cancela.
- **Mapa de asientos** interactivo. Al elegir un asiento se bloquea 5 minutos para los demás.
- **Pago simulado** con clave de idempotencia y boleto con código de reserva único.
- **Actualizaciones en vivo** por SSE para todos los clientes conectados.
- **Área administrativa** con el dashboard de cada vuelo: ocupación, etapa de los bloqueos y actividad reciente.

## Garantías

- **Un asiento nunca se vende dos veces:** el cambio de estado es un `UPDATE` condicional atómico, no una lectura seguida de una escritura.
- **Nunca se cobra dos veces:** cada compra lleva una clave de idempotencia; si el cobro se autoriza y la reserva falla, se anula.
- **Todos ven los cambios al instante:** los eventos se publican después del commit y el cliente ignora los que traen una versión anterior.
- **El servidor manda el reloj:** todos los tiempos se calculan con `now()` de PostgreSQL.

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | React 18, Vite y TypeScript |
| Backend | Node 20, Express y TypeScript |
| Datos | PostgreSQL 16 con TypeORM (migraciones, sin `synchronize`) |
| Tiempo real | Server-Sent Events |
| Arquitectura | Hexagonal (puertos y adaptadores) |
| Pruebas | Vitest, Testing Library y supertest |

## Cómo ejecutarlo

### Con Docker (recomendado)

```bash
docker-compose up --build
```

Abre http://localhost:8080. No necesita ningún archivo `.env`: todos los valores tienen un valor por defecto. Para cambiarlos, copia `.env.example` a `.env`.

Docker levanta tres servicios: `db` (PostgreSQL), `api` (backend, que corre las migraciones y los datos inciales al arrancar) y `web` (nginx, que sirve el frontend y reenvía `/api` a la API en un único origen).

### Desarrollo local

```bash
cp .env.example backend/.env
docker-compose up -d db     # PostgreSQL en el puerto 5433 del equipo
npm install
npm run dev                 # backend y frontend a la vez
```

- Frontend: http://localhost:5173 (reenvía `/api` al backend)
- Backend: http://localhost:3000/api

Si el backend corre en otro puerto, define `SERVER_PORT` para él y `DEV_API_TARGET=http://localhost:<puerto>` para el frontend.

### Comandos

```bash
npm run lint         # ESLint en backend y frontend
npm run build        # compila shared, backend y frontend
npm test             # todas las pruebas (las de integración necesitan PostgreSQL)
npm run db:reset     # borra el volumen y reconstruye la base con la semilla
```

Dentro de `backend/`: `npm run test:unit`, `npm run test:integration` y `npm run db:reset` (este último solo rehace las tablas del proyecto, sin borrar el volumen).

## Demo

**Dashboard:** http://localhost:8080/admin/login

| Usuario | Contraseña |
| --- | --- |
| `admin` | `admin` |

Tras iniciar sesión se llega a la búsqueda de vuelos; "Ver dashboard" abre el dashboard del vuelo elegido.

**Pago rechazado:** una tarjeta cuyo número termina en `0000` simula un pago rechazado. Cualquier otro número de tarjeta, con fecha vigente y CVV, se aprueba (no se verifica el dígito de control).

**Datos de ejemplo:** siete vuelos entre `BOG`, `MDE`, `CLO`, `CTG` y `BAQ`, de 48 asientos cada uno, con fechas de "mañana" y "pasado mañana".
- `AV101` a `AV103` (Bogotá a Medellín, mañana) tienen ocupaciones distintas para probar la lista.
- `AV105` y `AV107` tienen solo dos asientos libres: vender el último muestra el paso a "Vendido" en vivo.
- `AV106` ya está agotado.

Las fechas de la semilla son relativas al día en que se genera. Si la base viene de un día anterior, el backend la regenera al arrancar.

**Prueba con dos pestañas:** abre el mapa de asientos de un vuelo en dos pestañas. Al elegir un asiento en una, la otra lo ve bloqueado al instante; al pagarlo pasa a ocupado en ambas, y el dashboard de ese vuelo (en una tercera pestaña, con sesión de administrador) registra cada evento.

## Estructura

```
backend/
└── src/
    ├── domain/            # Entidades y reglas puras
    ├── application/       # Casos de uso y puertos de entrada
    └── infraestructure/   # Express, TypeORM, SSE y adaptadores de salida
frontend/
└── src/
    ├── api/               # Cliente REST
    ├── realtime/          # EventSource, store y reducer
    ├── features/          # Pantallas: flights, seat, checkout, booking, admin
    └── components/        # Componentes compartidos
shared/
└── src/                   # Enums, DTOs, eventos y códigos de error
```

`infraestructure` se escribe así en todo el proyecto.

## Decisiones clave

- **Monolito modular hexagonal:** el dominio no depende de frameworks; `typeorm`, `pg` y `express` viven solo en `infraestructure`.
- **PostgreSQL:** las sentencias que cambian un asiento, un vuelo o una clave de idempotencia son SQL parametrizado y atómico.
- **SSE unidireccional:** los comandos van por REST y las notificaciones por SSE. Al conectar se pide un snapshot y cada evento lleva una `version`, así que no hace falta un búfer de eventos para reconectar.
- **Pago fuera de la transacción:** no se retienen filas mientras se llama a la pasarela; la autorización se registra antes y se compensa solo si se comprobó que no hubo commit.
- **Margen de pago:** el servidor exige 10 segundos antes de cobrar y el cliente cuenta hasta `payableUntil`, no hasta el vencimiento del bloqueo.
- **Tres estados de vuelo** (`ON_SALE`, `SOLD_OUT`, `CANCELLED`): el sistema monitorea la venta, no la operación del vuelo, por eso no hay estado "retrasado". La regla de tiempo real de la búsqueda se cumple con los cambios que sí existen: agotado y cancelado.
- **Migraciones de TypeORM** en lugar de un `init.sql`, con semilla determinista.
- **Un único store en el frontend:** un evento solo se aplica si su `version` es mayor que la que ya se tiene.
- **Administración sencilla:** login de cliente (`admin`/`admin`) y clave compartida para `/api/admin`. Es un límite consciente de la prueba, no autenticación real.

## Pruebas

- **Unitarias (backend):** validaciones, diagnóstico de asientos y utilidades, sin base de datos.
- **Integración (backend):** contra PostgreSQL real, en su propio esquema (`flight_test`), sin tocar las tablas de la aplicación. Cubren el bloqueo concurrente, la compra, la idempotencia, los eventos SSE, los endpoints de lectura, los límites de día en la búsqueda y la regeneración de la semilla. Las de concurrencia lanzan varias solicitudes a la vez.
- **Frontend:** reducer y reglas de versión, cliente de la API y cada pantalla (búsqueda, mapa, pago, boleto y administración) con un `EventSource` controlable.
- **Conciliación:** cinco consultas que deben devolver cero filas después de cualquier prueba (asientos reservados sin reserva, reservas sin asiento, estado de vuelo incoherente, cobros huérfanos y claves de idempotencia atascadas).

Las pruebas de integración usan las credenciales de `backend/.env`; sin un PostgreSQL disponible no pueden correr.

## Limitaciones conocidas

- No hay pruebas E2E con navegador: la verificación con dos pestañas es manual.
- La pantalla de simulación de vuelos (`/admin/flights`) no está construida. Un vuelo se cancela con `POST /api/admin/flights/:id/cancel` y la clave de administrador en `X-Admin-Key`.
- Cancelar un vuelo no anula ni reembolsa sus reservas.
- Los datos del pasajero se guardan sin cifrar.
- El bus de eventos está en memoria, así que funciona con una sola instancia del backend.
- La actividad reciente del dashboard vive solo en el navegador y empieza vacía al recargar.

## Documentación

- [docs/architecture.md](docs/architecture.md): diseño, concurrencia, API y decisiones.
- [docs/ia.md](docs/ia.md): registro del uso de IA, incluidos los errores y correcciones.
- [docs/TESTS.md](docs/TESTS.md): detalle de las pruebas.
