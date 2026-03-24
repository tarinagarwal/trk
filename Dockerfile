# Install dependencies only when needed
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

# Rebuild the source code only when needed
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
# Ensure we don't use any local node_modules
RUN rm -rf node_modules
COPY --from=deps /app/node_modules ./node_modules

# Environment variables must be present at build time
# for some Next.js optimizations
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_WC_PROJECT_ID
ARG NEXT_PUBLIC_RPC_URL
ARG NEXT_PUBLIC_ENABLE_TESTNETS
ARG NEXT_PUBLIC_HARDHAT_RPC_URL
ARG NEXT_PUBLIC_ETHERSCAN_API_KEY

ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_WC_PROJECT_ID=$NEXT_PUBLIC_WC_PROJECT_ID
ENV NEXT_PUBLIC_RPC_URL=$NEXT_PUBLIC_RPC_URL
ENV NEXT_PUBLIC_ENABLE_TESTNETS=$NEXT_PUBLIC_ENABLE_TESTNETS
ENV NEXT_PUBLIC_HARDHAT_RPC_URL=$NEXT_PUBLIC_HARDHAT_RPC_URL
ENV NEXT_PUBLIC_ETHERSCAN_API_KEY=$NEXT_PUBLIC_ETHERSCAN_API_KEY
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_FONT_GOOGLE_MOCKS=1

RUN npm run build

# Production image, copy all the files and run next
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000

CMD ["node", "server.js"]

