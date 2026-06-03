FROM docker.m.daocloud.io/library/node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com \
    && npm ci

COPY . .

ARG VITE_AI_BASE_URL=/ai/api/v1
ENV VITE_AI_BASE_URL=${VITE_AI_BASE_URL}

RUN npm run build

FROM docker.m.daocloud.io/library/nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
