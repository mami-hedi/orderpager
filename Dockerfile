# Image de production : compile le front React, puis sert tout depuis Node (API + WebSocket + front).

# --- Étape 1 : compilation du front ---------------------------------------
FROM node:20-alpine AS client-build
WORKDIR /build
COPY client/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY client/ ./
RUN npm run build

# --- Étape 2 : serveur ----------------------------------------------------
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
COPY server/ ./
# Le serveur cherche le front dans ../../client/dist (voir server/src/index.js)
COPY --from=client-build /build/dist /app/client/dist

USER node
EXPOSE 4000

# Crée/migre les tables au démarrage (idempotent), puis lance l'API
CMD ["sh", "-c", "node scripts/init-db.js && node src/index.js"]
