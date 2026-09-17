FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY packages/sdk-ts packages/sdk-ts
COPY packages/gateway packages/gateway

RUN npm ci
RUN npm --prefix packages/sdk-ts run build
RUN npm --prefix packages/gateway run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages/sdk-ts packages/sdk-ts
COPY --from=builder /app/packages/gateway packages/gateway

EXPOSE 8080

CMD ["node", "packages/gateway/dist/index.js"]
