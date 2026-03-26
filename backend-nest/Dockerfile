FROM node:22-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the NestJS app
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/main"]
