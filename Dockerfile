FROM node:22-bookworm-slim AS dependencies

WORKDIR /app
RUN npm install --global pnpm@10.29.2

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS source
COPY apps/api apps/api
COPY apps/web apps/web

FROM source AS api-build
RUN pnpm build:api

FROM node:22-bookworm-slim AS api
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=dependencies /app/node_modules node_modules
COPY --from=dependencies /app/apps/api/node_modules apps/api/node_modules
COPY --from=api-build /app/apps/api/package.json apps/api/package.json
COPY --from=api-build /app/apps/api/dist apps/api/dist
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]

FROM source AS migrate
CMD ["pnpm", "--filter", "@booking/api", "exec", "prisma", "db", "migrate", "--yes"]

FROM source AS web-build
ARG VITE_API_URL=/
ENV VITE_API_URL=${VITE_API_URL}
RUN pnpm build:web

FROM nginx:1.27-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
