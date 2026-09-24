# Test Coverage Documentation

## Overview

This document outlines the comprehensive test suite for the flight reservation system, covering integration tests (backend), unit tests (backend), and state/API tests (frontend).

## Backend Integration Tests

Integration tests use **real PostgreSQL database** (no mocks) per CLAUDE.md §14 requirement.

### Test Files

#### 1. **SeatLocking.test.ts**
Tests core concurrency guarantees for seat reservation.

- **Prevent double-locking**: Ensures only one client can lock a seat at a time
- **Expired lock handling**: Verifies new clients can lock seats after lock expiry
- **Version tracking**: Confirms version increments on each operation
- **Concurrent lock safety**: Tests race condition with 5+ simultaneous lock attempts
- **ACID properties**: Verifies atomic lock + reserve operations

**Critical for**: Preventing seat overbooking, maintaining data consistency under concurrent load

#### 2. **Idempotency.test.ts**
Tests duplicate request detection and idempotency key management.

- **Duplicate prevention**: Same idempotency key cannot be claimed twice
- **Hash mismatch detection**: Different request body with same key is rejected
- **State tracking**: Idempotency key status properly tracked through lifecycle
- **Concurrent idempotency**: Multiple concurrent claims with same key are safely handled
- **Retry safety**: Clients can retry with same key and hash

**Critical for**: Preventing duplicate charges, handling network retries safely

#### 3. **ReservationFlow.test.ts**
End-to-end flow from lock through reservation creation.

- **Complete flow**: Lock → Verify → Reserve → Create Reservation
- **Concurrent different seats**: Multiple clients reserve different seats simultaneously
- **Seat unavailability**: Prevents reservation if seat becomes unavailable mid-flow
- **Partial failure recovery**: System recovers if transaction fails mid-process
- **Data consistency**: All data remains valid after failure

**Critical for**: Ensuring complete reservation flows work correctly under real conditions

#### 4. **EventPublishing.test.ts**
Tests real-time event publishing for SSE clients.

- **Event publishing**: Seat lock/reserve events published after transaction commits
- **Event ordering**: Events published in chronological order with version tracking
- **Version increments**: Event versions increase monotonically for ordering on clients
- **Transaction safety**: Events only published after successful commit

**Critical for**: Real-time UI updates, client-side consistency

#### 5. **ConcurrentReservations.test.ts**
High-concurrency stress tests simulating real load.

- **Overbooking prevention**: 10 concurrent lock attempts on 1 seat → 1 succeeds
- **Rapid cycles**: Multiple lock-reserve sequences maintain consistency
- **Double-reserve prevention**: Cannot reserve same seat twice
- **Failure recovery**: System state valid after operation failures
- **Version staleness**: Detects and handles out-of-order operations
- **100+ concurrent ops**: Handles extreme load without data corruption

**Critical for**: Ensuring system scales and doesn't overbooking under load

### Backend Unit Tests

#### 6. **AppError.test.ts**
Tests error creation and serialization.

- Error factory methods (badRequest, conflict, notFound, etc.)
- Status code mapping
- JSON serialization with details
- Error instanceof checks

#### 7. **CreateReservation.test.ts**
Tests reservation use case logic with mocked dependencies.

- Idempotency key validation
- Flight existence checking
- Seat lock verification
- Payment authorization failures
- Payment decline handling
- Logging on success/failure

## Frontend Tests

Frontend tests use Vitest with happy-dom (lightweight virtual DOM).

### Test Files

#### 8. **reducer.test.ts**
Tests global state management reducer.

- **Connection states**: Transitioning between connecting/live/reconnecting
- **Flight data**: Setting and updating flight information
- **Seat snapshots**: Loading seat availability from API
- **Event handling**:
  - `seat.locked`: Updates seat status with lock information
  - `seat.released`: Reverts seat to available
  - `seat.reserved`: Marks seat as sold and clears user's lock
  - `flight.updated`: Updates flight status and availability
- **Version-based filtering**: Ignores stale events with older versions
- **Lock management**: User's current lock tracking
- **Activity log**: Maintains limited history of events (10 most recent)

**Critical for**: Real-time UI consistency, preventing old data from overwriting new data

#### 9. **client.test.ts**
Tests API client request/response handling.

- **URL construction**: Flight search, seat snapshot queries
- **Headers**:
  - `Content-Type: application/json`
  - `X-Client-Id`: Session identifier
  - `Idempotency-Key`: Duplicate prevention
- **HTTP methods**: POST (lock), DELETE (unlock), PATCH (flight status)
- **Request bodies**: Correct serialization of data
- **Error handling**: Proper error parsing and throwing
- **Response parsing**: JSON deserialization

**Critical for**: Correct API communication, idempotency header inclusion

## Test Execution

### Running All Tests
```bash
npm test                          # Both backend and frontend
npm test -w backend               # Backend only
npm test -w frontend              # Frontend only
```

### Running Integration Tests Only
```bash
npm run test:integration -w backend
```

### Running with Coverage
```bash
npm test -- --coverage
```

### Test Requirements

**Backend**:
- PostgreSQL running locally (default: localhost:5432, postgres/postgres)
- Or set via environment variables:
  ```bash
  DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASSWORD=postgres npm test
  ```

**Frontend**:
- No external dependencies (happy-dom provides DOM simulation)

## Coverage Goals

Per CLAUDE.md Definition of Done:

✅ **All concurrency rules have integration tests** against real PostgreSQL
✅ **No in-memory mocks** for database operations
✅ **Event ordering** tested with version tracking
✅ **Idempotency** tested with concurrent operations
✅ **Unit tests** for business logic and error handling
✅ **State management** tested thoroughly

## Known Test Limitations

1. **Payment Gateway**: Mocked in unit tests; FakePaymentGateway used in integration
2. **Email/SMS**: Not tested (external service)
3. **Admin Key Middleware**: Not tested in test suite (configured at deployment)
4. **E2E**: No full browser testing; integration tests cover API level

## Future Improvements

1. Add E2E tests with Playwright for user flows
2. Add load testing for 1000+ concurrent reservations
3. Add chaos engineering tests (network failures, database restarts)
4. Add mutation testing to verify test effectiveness
5. Add performance benchmarks for critical paths

---

**Last Updated**: 2026-09-24
**Test Framework**: Vitest + TypeORM integration
