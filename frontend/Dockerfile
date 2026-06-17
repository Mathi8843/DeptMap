FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and build
COPY . .
ENV NEXT_PUBLIC_API_URL=http://localhost:8000
RUN npm run build

# Expose port
EXPOSE 3000

# Start app
CMD ["npm", "run", "start"]
