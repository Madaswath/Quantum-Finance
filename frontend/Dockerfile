# Stage 1: Build the Angular app
FROM node:20 AS build
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve the app with Node.js
FROM node:20-alpine
WORKDIR /usr/src/app
COPY --from=build /usr/src/app/dist/app /usr/src/app/dist/app
COPY package*.json ./
# Install only production dependencies if needed, or skip if dist contains everything.
RUN npm install --omit=dev

EXPOSE 4000
CMD ["npm", "run", "serve:ssr:app"]