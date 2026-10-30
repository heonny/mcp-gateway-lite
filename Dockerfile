FROM node:26-alpine AS build
WORKDIR /app

# node:26 images no longer bundle corepack. Pinned to the pnpm that wrote pnpm-lock.yaml; keep in sync with CI.
RUN npm install -g pnpm@10.34.9

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .
RUN pnpm build
RUN pnpm prune --prod

FROM node:26-alpine
WORKDIR /app

COPY --from=build /app/package.json /app/pnpm-lock.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/config.example.yml ./config.example.yml

USER node

EXPOSE 8610

CMD ["node", "dist/main.js", "--config", "/app/config.yml"]
