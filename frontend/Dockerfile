# syntax=docker/dockerfile:1

# ---------- Build ----------
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies from the lockfile for reproducible builds.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines VITE_* variables at build time. Override them with --build-arg.
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_APP_NAME=Docuflow
ARG VITE_MAX_UPLOAD_MB=25
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_APP_NAME=$VITE_APP_NAME \
    VITE_MAX_UPLOAD_MB=$VITE_MAX_UPLOAD_MB

RUN npm run build

# ---------- Runtime ----------
FROM nginx:1.27-alpine AS runtime

# The config serves the SPA and proxies /api/ to the `backend` service.
# Change `proxy_pass` in nginx.conf if your API lives elsewhere.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost/healthz || exit 1
