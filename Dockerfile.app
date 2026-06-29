FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev 2>/dev/null || npm install
COPY . .
RUN npm run build
ENV NODE_ENV=production
CMD ["node", "dist/index-prod.js"]
