# Sistema de Reservas de Vuelos en Tiempo Real

Prototipo Full Stack Senior de un sistema de reservas de vuelos con actualizaciones en tiempo real mediante SSE.

## Características

- **Búsqueda de vuelos** con filtros por origen, destino y fecha
- **Mapa de asientos** interactivo con bloqueo temporal
- **Compra con pago simulado** e idempotencia
- **Actualizaciones en vivo** para todos los clientes conectados
- **Dashboard administrativo** con ocupación en tiempo real
- **Simulación de cambios de estado** de vuelos

## Garantías del Sistema

- ✅ **Nunca se vende dos veces el mismo asiento** (índice único + transacción)
- ✅ **Nunca se cobra dos veces** (clave de idempotencia + versioning)
- ✅ **Todos ven los cambios al instante** (SSE desde la base de datos)

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| Backend | Node 20 LTS + Express + TypeScript |
| Datos | PostgreSQL 16 con TypeORM |
| Tiempo Real | Server-Sent Events (SSE) |
| Arquitectura | Hexagonal (puertos y adaptadores) |

## Ejecución

### Con Docker (recomendado)

```bash
cp .env.example .env
docker-compose up --build
# Abre http://localhost:8080
```

### Desarrollo Local

```bash
cp .env.example .env
docker-compose up -d db
npm install
npm run dev
# Frontend: http://localhost:5173
# Backend: http://localhost:3000
# API: http://localhost:3000/api
```

### Comandos

```bash
npm run lint        # Valida reglas de arquitectura
npm test            # Ejecuta pruebas unitarias
npm run db:reset    # Reinicia la base de datos y semilla
```

## Arquitectura

```
backend/
├── src/
│   ├── domain/          # Entidades y lógica pura (sin dependencias)
│   ├── application/     # Casos de uso y puertos
│   └── infraestructure/ # Express, TypeORM, adaptadores
frontend/
├── src/
│   ├── api/             # Cliente REST
│   ├── realtime/        # EventSource + reducer
│   ├── features/        # Pantallas
│   └── components/      # Componentes reutilizables
shared/
└── src/                 # Enums, DTOs, eventos, errores (fuente única)
```

## Documentación

- **[architecture.md](docs/architecture.md)** — Decisiones, diseño y garantías de concurrencia
- **[ia.md](docs/ia.md)** — Registro del uso de IA en la implementación

## Decisiones Clave

- **Monolito modular hexagonal**: Dominio aislado, fácil de testear, sin dependencias de frameworks
- **PostgreSQL como fuente de verdad**: UPDATE condicional atómico, no lecturas-y-escrituras manuales
- **SSE unidireccional**: Comandos por REST, notificaciones por SSE; sin WebSockets
- **Snapshot + version**: Reconexión segura, sin buffer de eventos
- **Migraciones de TypeORM**: Schema versionado, reversible, con semilla determinista
- **Pago fuera de la transacción**: No retiene filas durante llamadas externas; compensación con `void`

## Testing

- **Unit tests**: Casos de uso con repositorios falsos en memoria
- **Integration tests**: Contra PostgreSQL real; concurrencia de N solicitudes
- **E2E**: Playwright con dos pestañas abiertas a la vez
- **Conciliación**: 5 consultas que validan coherencia post-prueba

---

Ver [architecture.md](docs/architecture.md) para detalles completos de diseño, concurrencia y API.
