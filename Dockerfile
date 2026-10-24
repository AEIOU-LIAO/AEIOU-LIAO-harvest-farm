FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY shared ./shared
COPY server ./server
COPY src ./src
COPY index.html admin.html ./
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 DB_PATH=/data/farm.db BACKUP_DIR=/data/backups TRUST_PROXY=1
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.js"]
