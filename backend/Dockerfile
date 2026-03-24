FROM node:20-slim

# Install openssl for Prisma and curl for healthchecks
RUN apt-get update && apt-get install -y openssl curl

WORKDIR /app

COPY . .
# Force generation of node_modules on the spot
RUN rm -rf node_modules
RUN npm install

# Generate Prisma Client
RUN npx prisma generate

EXPOSE 3001

# Run migrations and start app
CMD npx prisma db push && npm start
