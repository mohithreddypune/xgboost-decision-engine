# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /workspace
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# --- runtime stage ---
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist/dashboard /usr/share/nginx/html
EXPOSE 80
