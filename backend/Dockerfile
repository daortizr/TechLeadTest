# Build context is the repository root: shared/ is compiled together with the backend.

# ---- Dependencies and build ----
FROM node:20-alpine AS build
WORKDIR /app

# Manifests first so the dependency layer is cached until they change.
# frontend/package.json is needed too: npm ci checks the lockfile against every workspace.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci

COPY tsconfig.base.json ./
COPY shared/ shared/
COPY backend/ backend/
RUN npm run build -w @flight-reservations/shared \
 && npm run build -w @flight-reservations/backend

# ---- Runtime ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --omit=dev -w @flight-reservations/backend -w @flight-reservations/shared \
 && npm cache clean --force

COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/backend/dist backend/dist

# Unprivileged user (the image ships with `node`)
USER node
EXPOSE 3000

# Migrations and seed run when the server starts
CMD ["node", "backend/dist/index.js"]
