# Build context is the repository root: shared/ is compiled together with the frontend.

# ---- Dependencies and build ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci

COPY tsconfig.base.json ./
COPY shared/ shared/
COPY frontend/ frontend/

# Relative base: the browser always talks to the origin that served the page
ARG VITE_API_URL=/api
ARG VITE_ADMIN_KEY
ENV VITE_API_URL=$VITE_API_URL \
    VITE_ADMIN_KEY=$VITE_ADMIN_KEY

RUN npm run build -w @flight-reservations/frontend

# ---- Runtime: static files and /api proxy ----
FROM nginx:alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
