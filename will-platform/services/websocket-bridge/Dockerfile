FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY src/ ./src/
USER 1000:1000
EXPOSE 7000
CMD ["node", "src/index.js"]
