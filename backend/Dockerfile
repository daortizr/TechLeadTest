# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY shared/ ./shared/
COPY backend/ ./backend/

RUN npm install
RUN npm run build --workspace=@flight-reservations/shared
RUN npm run build --workspace=@flight-reservations/backend

# Runtime stage
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/backend/dist ./backend/dist
COPY backend/src/infraestructure/database/sql ./backend/src/infraestructure/database/sql

RUN npm install --omit=dev

RUN addgroup -S nodeuser && adduser -S nodeuser -G nodeuser
USER nodeuser

EXPOSE 3000

CMD ["node", "backend/dist/index.js"]
