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
FROM node:18-alpine

WORKDIR /
COPY package.json yarn.lock ./
RUN yarn install

COPY . .
RUN yarn build

EXPOSE 3000
CMD ["yarn", "start"]