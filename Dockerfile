FROM node:20-bullseye AS builder
WORKDIR /app
COPY package.json next.config.js ./

RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    python3 \
    && rm -rf /var/lib/apt/lists/*


# A bunch of canvas bs
ENV npm_config_canvas_binary_host_mirror=https://github.com/Automattic/node-canvas/releases/download/
ENV CXXFLAGS="-DSYZX_FEATURE_FLAG=1"

COPY package.json yarn.lock* ./
RUN yarn install --network-timeout 100000 || \
    (echo "Retrying with canvas workaround..." && \
     yarn add canvas@2.11.2 --network-timeout 100000 && \
     yarn install --network-timeout 100000)


COPY . .
RUN yarn build


FROM node:20-bullseye
WORKDIR /app

RUN apt-get update && apt-get install -y \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
RUN mkdir -p /auth
CMD ["yarn", "start"]