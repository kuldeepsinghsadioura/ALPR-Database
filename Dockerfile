# # Dependencies
# FROM node:18-slim AS base

# RUN apt-get update && \
#     apt-get install -y \
#     python3 \
#     python3-pip \
#     make \
#     g++ \
#     && rm -rf /var/lib/apt/lists/*

# ENV PYTHON=/usr/bin/python3

# WORKDIR /

# FROM base AS production

# COPY package*.json yarn.lock ./
# RUN yarn install

# COPY . .

# CMD ["yarn", "start"]

# Build stage
# FROM node:18-bullseye AS builder

# WORKDIR /
# COPY package.json yarn.lock ./
# RUN yarn install

# COPY . .
# RUN yarn build

# # Copy the built assets to the final image
# FROM node:18-bullseye
# WORKDIR /
# COPY --from=builder /node_modules ./node_modules
# COPY --from=builder /.next ./.next
# COPY --from=builder /public ./public
# COPY --from=builder /app ./app
# COPY --from=builder /lib ./lib
# COPY --from=builder /components ./components
# COPY --from=builder /config ./config
# COPY --from=builder /middleware.js ./middleware.js
# COPY --from=builder /hooks ./hooks
# COPY --from=builder /auth ./auth
# COPY --from=builder /package.json ./package.json
# COPY --from=builder /yarn.lock ./yarn.lock
# COPY --from=builder /next.config.js ./next.config.js
# COPY --from=builder /jsconfig.json ./jsconfig.json
# COPY --from=builder /postcss.config.mjs ./postcss.config.mjs
# COPY --from=builder /tailwind.config.js ./tailwind.config.js

# EXPOSE 3000
# CMD ["yarn", "start"]

FROM node:18-bullseye AS builder
WORKDIR /app
COPY package.json next.config.js ./
RUN yarn install
COPY . .
RUN yarn build

# Final stage
FROM node:18-bullseye
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app /app
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["yarn", "start"]