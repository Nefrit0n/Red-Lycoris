# ── Stage: Development (Vite dev server) ──
FROM node:20-alpine AS development

WORKDIR /app

COPY package.json package-lock.json* ./
ENV NPM_CONFIG_INCLUDE=optional
RUN npm ci --include=optional

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

# ── Stage: Production Build ──
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
ENV NPM_CONFIG_INCLUDE=optional
RUN npm ci --include=optional

COPY . .
RUN npm run build

# ── Stage: Production (nginx) ──
FROM nginx:stable-alpine AS production

COPY --from=build /app/dist /usr/share/nginx/html

RUN printf 'server {\n\
    listen 8080;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location /api/ {\n\
        proxy_pass http://backend:8080;\n\
        proxy_set_header Host $host;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
    }\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

# nginx user (uid 101 in nginx:alpine)
USER 101

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
