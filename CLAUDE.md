# Reservas de vuelos en tiempo real

Prueba técnica Full Stack Senior. La fuente de verdad del diseño es `docs/architecture.md`.

## Antes de escribir código

1. Lee las secciones de `docs/architecture.md` que correspondan a la tarea (mapa abajo). No adivines contratos, nombres de eventos, códigos de error ni SQL: están en ese documento.
2. Si la tarea contradice una decisión del documento, dilo y pregunta antes de seguir.
3. Si el cambio toca más de un módulo o capa, propón primero un plan breve y espera mi confirmación.
4. Trabaja en rebanadas verticales pequeñas: ruta, caso de uso, adaptador y prueba, en ese orden.

## Mapa: tarea y sección

| Tarea | Secciones de `docs/architecture.md` |
| --- | --- |
| Estructura de carpetas, casos de uso, puertos | 3 y 4 |
| Base de datos, entidades, SQL de esquema, datos semilla | 5 y 6 |
| Bloqueo, checkout, compra, expiración | 7 (7.0 a 7.5) y 6 |
| SSE, eventos, snapshot, reconexión | 8 |
| Endpoints, validaciones, errores | 9 |
| Pantallas, estado compartido, pago, boleto, dashboard, admin | 10 |
| Estilos y colores | 11 |
| Docker, nginx, variables de entorno | 12 y 13 |
| Pruebas | 14 |
| Reglas completas para asistentes | 16 |

## Reglas que no se negocian (resumen de la sección 16)

**Arquitectura**
- `domain` no importa nada del proyecto salvo `shared`. `application` solo importa `domain` y `infraestructure/outputPorts`. `typeorm`, `pg` y `express` solo existen dentro de `infraestructure`.
- La carpeta se escribe `infraestructure`, con esa grafía.
- Un caso de uso por archivo, con su puerto de entrada. Los controllers devuelven DTOs de `shared`, nunca entidades.
- Las transacciones se abren con `UnitOfWork.run`; los repositorios reciben el `TransactionContext` como primer parámetro.

**Datos y concurrencia**
- Toda sentencia que cambie un asiento, un vuelo o una clave de idempotencia es SQL parametrizado y atómico con `manager.query`, dentro de un adaptador de salida. Prohibidos `QueryBuilder` en ellas y el patrón leer-y-luego-escribir.
- Todo tiempo se calcula con `now()` de PostgreSQL.
- Estados del vuelo: solo `ON_SALE`, `SOLD_OUT` y `CANCELLED`. Un vuelo es reservable con `ON_SALE` y si aún no despegó. Solo se cancelan vuelos `ON_SALE`. No hay retrasos ni seguimiento de la operación del vuelo.
- El servidor exige `PAYMENT_MARGIN_SECONDS` antes de cobrar; el cliente cuenta hasta `payableUntil`, nunca hasta `lockedUntil`.
- Nunca llames a la pasarela de pago dentro de una transacción. La autorización se registra en `payments` (autocommit) antes de la transacción de reserva, y solo se compensa si se comprobó que no hubo commit (7.3).
- Cuando un `UPDATE` condicional no afecta filas, el motivo se clasifica con `SeatRepository.diagnose` y `diagnoseSeat` (7.1); el diagnóstico solo explica, no decide.
- Un bloqueo está vencido con `locked_until <= now()` y activo con `locked_until > now()`. Identificadores en inglés (`SELECTING`, `CHECKOUT`, `RESERVED`…); los textos en español salen de `lib/labels.ts`.
- Los eventos SSE se publican después del commit.
- `synchronize: false`. `init.sql` es la fuente de verdad del esquema. Cada `@Column` declara su tipo explícito.

**Seguridad**
- `locked_by`, números de tarjeta, CVV y la clave de administrador nunca salen del servidor ni entran en logs, eventos o respuestas.
- Documento, teléfono y correo del pasajero son datos personales: se redactan en los logs y ninguna respuesta los devuelve. El boleto solo muestra el nombre.
- Toda la API va bajo `/api`; lo administrativo bajo `/api/admin` con el middleware de clave.
- Validar toda entrada con zod en el borde HTTP. Errores con `AppError`; nunca un `catch` vacío.

**Código**
- TypeScript estricto, sin `any`. Tipos de DTOs, eventos y enums solo desde `shared/`.
- Sin dependencias nuevas sin justificarlas por escrito.
- Código y nombres en inglés; textos de usuario en español. Commits convencionales (`feat:`, `fix:`, `test:`, `docs:`).

**Frontend**
- Un único store con reducer; un evento solo se aplica si su `version` es mayor.
- Usar solo los tokens de color de la sección 11. El rojo no se usa para "ocupado" y ningún estado depende solo del color.
- Los datos de tarjeta viven solo en el estado local del formulario.
- La API se consume con la URL base relativa `/api`.

## Pruebas

- Toda regla de concurrencia lleva prueba de integración contra Postgres real. Los falsos en memoria no la sustituyen.
- Después de cada cambio, ejecuta `npm run lint` y las pruebas relevantes, e informa el resultado. No des una tarea por terminada si fallan.

## Comandos (agregar a medida que existan)

- `docker-compose up --build`: sistema completo en `http://localhost:8080`
- `docker-compose up -d db` y `npm run dev`: desarrollo local
- `npm run lint`, `npm test`
- `npm run db:reset`: restablece la base y el seed

## Demo y README

- El README documenta las credenciales del área administrativa (`admin`/`admin`) y que la tarjeta terminada en `0000` simula un pago rechazado. Ninguna de las dos cosas se muestra en pantalla.

## Transparencia

Esta prueba exige documentar el uso de IA en `docs/ia.md`. Si generas algo que luego resulta incorrecto o subóptimo, o si corriges algo tuyo, dilo con claridad para que quede registrado.

## Definition of done

Compila sin errores ni advertencias, pasan lint y pruebas, la conciliación de la sección 5.3 devuelve cero filas, y el cambio se ve en dos pestañas abiertas a la vez. Si una decisión cambió, se actualizan `README.md` y `docs/architecture.md`.
