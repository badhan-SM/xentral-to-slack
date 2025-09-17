# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application files
COPY . .

# Cloud Run uses PORT environment variable
ENV PORT=8080

# Expose the port
EXPOSE 8080

# Start the application
CMD ["node", "index.js"]