# Dockerfile for Pusat Games Buddhis
FROM node:22-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . .

# Build Vite frontend
RUN npm run build

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Start Express + SQLite server
CMD ["npm", "start"]
