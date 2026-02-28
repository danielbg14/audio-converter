FROM node:18-alpine
WORKDIR /app
COPY package.json .
# Use npm ci when a lockfile is present, otherwise fall back to npm install
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
# Build for production inside the image
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
