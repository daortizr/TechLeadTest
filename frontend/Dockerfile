# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY shared/ ./shared/
COPY frontend/ ./frontend/

RUN npm install
RUN npm run build --workspace=@flight-reservations/shared
RUN npm run build --workspace=@flight-reservations/frontend

# Runtime stage
FROM nginx:alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
