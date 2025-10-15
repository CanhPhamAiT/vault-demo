FROM node:18-alpine

WORKDIR /app

# Create public directory
RUN mkdir -p public

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY server.js .
COPY ui_enhanced.html ./public/index.html

EXPOSE 8080

CMD ["node", "server.js"]