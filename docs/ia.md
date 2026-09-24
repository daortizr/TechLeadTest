# Uso de Inteligencia Artificial

Este documento registra de forma transparente cómo se usó IA en la prueba. Se llena a medida que se trabaja; lo marcado con `[completar]` debe reemplazarse con datos reales antes de entregar. No incluir en él nada que no haya ocurrido.

## 1. Herramientas de IA utilizadas

| Herramienta | Versión / modelo | Uso |
| --- | --- | --- |
| Claude (Anthropic), en chat | [completar: modelo y versión] | Análisis del enunciado, diseño de arquitectura, modelo de datos, planeación del frontend y redacción de `docs/architecture.md` |
| Claude en Visual Studio Code | [completar: modelo, extensión y versión] | Generación y revisión de código siguiendo `docs/architecture.md` |
| [otra herramienta, si aplica] | [completar] | [completar] |

Todo el código generado con IA se guía por `docs/architecture.md`, en particular por su sección 16 (reglas para asistentes).

## 2. Prompts y casos de uso

Ejemplos de prompts clave. Se añaden filas a medida que se trabaja.

| # | Área | Prompt clave (resumen) | Resultado |
| --- | --- | --- | --- |
| 1 | Análisis | Analizar el PDF de la prueba y señalar qué evalúan y dónde están los riesgos | Identificación de la concurrencia como núcleo y del alcance como riesgo principal |
| 2 | Arquitectura | Elegir base de datos y mecanismo de tiempo real; comparar SSE y Socket.IO | PostgreSQL con `UPDATE` condicional y SSE con snapshot al reconectar |
| 3 | Backend | Diseñar cada historia de usuario (búsqueda, bloqueo, compra, dashboard) | Contratos de API, sentencias atómicas, eventos y pruebas por historia |
| 4 | Base de datos | Consolidar el modelo relacional a partir de las cuatro historias | Seis tablas, restricciones, índices y consultas de conciliación |
| 5 | Frontend | Listar pantallas, estados y diseñar el estado compartido | Rutas, reducer con control de versión y pantalla de pago |
| 6 | Diseño visual | Definir estilo blanco y rojo y un mockup del mapa de asientos | Tokens, reglas de color y estados del asiento |
| 7 | Código | [completar: prompt usado para generar un módulo concreto] | [completar] |
| 8 | Pruebas | [completar] | [completar] |

## 3. Decisiones propias del candidato

Decisiones tomadas por criterio propio durante el diseño, que cambiaron o completaron lo propuesto por la IA:

| Decisión | Qué propuso o preguntó la IA | Qué se decidió |
| --- | --- | --- |
| Uso de TypeORM | Recomendaba SQL explícito con `pg` | Usar TypeORM por dominio de la herramienta, con SQL explícito solo en las sentencias críticas |
| Duración del bloqueo | Rango de 5 a 10 minutos | 5 minutos |
| Reinicio del bloqueo al pulsar "Comprar" | No estaba contemplado | Se pidió reiniciarlo; la IA advirtió del riesgo de retener asientos y se limitó a una sola extensión |
| Pago como pantalla propia | Ofrecía pantalla o modal | Pantalla propia |
| Acceso al dashboard | Proponía clave de administrador | Ruta administrativa separada con login `admin`/`admin`, sin servicio de autenticación |
| Estructura del backend | Capas simples por módulo | Arquitectura hexagonal con `application`, `domain` e `infraestructure` |
| Estilo gráfico | Sin propuesta previa | Combinar el blanco y el rojo de Davivienda |
| Datos del pasajero | Nombre y correo | Ampliar a nombre, correo, documento (tipo `CC`, `CE` o pasaporte y número) y teléfono internacional |
| Alcance del vuelo | Contemplaba retrasos y horarios cambiantes | Descartar los retrasos: la aplicación monitorea la venta, no la operación; estados propios `EN_VENTA`, `VENDIDO` y `CANCELADO` (en el código, `ON_SALE`, `SOLD_OUT` y `CANCELLED`) |
| Cancelación | Permitía cancelar vuelos vendidos | Solo se cancelan vuelos en venta |
| "Volver al mapa" desde el pago | Ofrecía conservar o liberar el asiento | Conservar el bloqueo hasta que venza |
| Boleto | Mostraba nombre y documento enmascarado | Solo el nombre completo; sin consulta por código; con el estado del vuelo destacado |
| Pago rechazado | Proponía una nota visible sobre la tarjeta `0000` | Solo el aviso "El pago fue rechazado"; el truco se explica en el README y la sustentación |
| Margen de pago | Dejaba el margen de 10 s solo en el servidor | Sumarlo al bloqueo para dar 5:00 útiles al usuario |
| Administración | Proponía un panel único o separado | Dos pantallas (selector del dashboard y simulación), con credenciales ocultas y aterrizaje en `/admin/flights` |
| Datos semilla | Ocupación aleatoria sin forzar valores | Siete vuelos: dos parciales, dos vacíos, uno lleno y dos casi llenos (2 asientos libres) |
| Demo | Un TTL corto solo para la demo | Esperar los 5 minutos reales; demo de 5 minutos y 25 de arquitectura, con el orden: hexagonal y datos, IA, concurrencia, SSE |

## 4. Refactorización y criterio propio

Casos en los que la IA proporcionó una propuesta incorrecta o subóptima y cómo se corrigió. Los tres primeros se detectaron al revisar el diseño en el chat, y los cuatro siguientes los reportó Claude Code al revisar `architecture.md`; se debe completar quién los detectó y cómo, y añadir los que ocurran durante la implementación.

| # | Propuesta inicial | Problema | Corrección | Detectado por |
| --- | --- | --- | --- | --- |
| 1 | `CHECK` del bloqueo que solo comparaba el estado con la presencia de dueño y vencimiento | Permitía un asiento libre con solo uno de esos campos lleno | `CHECK` explícito con las dos ramas | [completar] |
| 2 | El reclick del dueño renovaba el bloqueo | Permitía retener un asiento indefinidamente | Idempotente, sin extender; la única extensión es la del checkout | [completar] |
| 3 | Borrar la clave de idempotencia tras un pago rechazado | Rompía la llave foránea de `payments` | Estado `FAILED` en lugar de borrar | [completar] |
| 4 | Orden de la compra sin límites transaccionales explícitos (dónde se registraba `payments`, qué iba dentro de la transacción) | Ambigüedad que impedía implementar y dejaba abierta qué pasa si falla la transacción | Fases A a E con límites explícitos; `payments` en `AUTHORIZED` antes de `T2`; matriz de compensación | Claude Code, al revisar el documento |
| 5 | Diagnóstico del `UPDATE` sin filas descrito sin SQL ni precedencia | No se podía implementar ni distinguir `SEAT_LOCKED`, `SEAT_RESERVED` y `FLIGHT_NOT_BOOKABLE` | Consulta única y tablas de clasificación con orden de precedencia | Claude Code, al revisar el documento |
| 6 | Términos "eligiendo/pagando" frente a `SELECTING`/`CHECKOUT`, y "ocupados" frente a `RESERVED` | Nomenclatura distinta entre interfaz, código y base de datos | Glosario único y `lib/labels.ts` | Claude Code, al revisar el documento |
| 7 | `FOR UPDATE` sobre la fila del vuelo | Candado más fuerte de lo necesario | `FOR NO KEY UPDATE` y análisis explícito de contención | Claude Code, al revisar el documento |
| 8 | Margen de 10 s antes de cobrar solo en el servidor | El usuario veía tiempo restante en pantalla pero recibía un error al pagar en los últimos 10 s | `payableUntil` y bloqueo de 5:10 para que el usuario tenga 5:00 útiles | [completar] |
| 9 | [completar con casos de código generado] | [completar] | [completar] | [completar] |

## 5. Impacto

Estimación del tiempo ahorrado y de las áreas donde la IA aportó más valor. Completar al final con datos reales.

| Área | Tiempo estimado sin IA | Tiempo real con IA | Comentario |
| --- | --- | --- | --- |
| Análisis y diseño | [completar] | [completar] | [completar] |
| Backend | [completar] | [completar] | [completar] |
| Base de datos | [completar] | [completar] | [completar] |
| Frontend | [completar] | [completar] | [completar] |
| Pruebas | [completar] | [completar] | [completar] |
| Documentación | [completar] | [completar] | [completar] |

Áreas de mayor valor: [completar]. Áreas donde hubo que corregir más: [completar].
