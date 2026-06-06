# ===== 构建阶段：编译前端 =====
FROM node:20-alpine AS builder

WORKDIR /app
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci
COPY client/ ./client/
RUN cd client && npm run build

# ===== 运行阶段：后端 =====
FROM node:20-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

# 先装依赖（利用缓存）
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --production

# 复制后端代码
COPY server/ ./server/

# 复制前端构建产物
COPY --from=builder /app/client/dist ./client/dist

# 数据目录
VOLUME ["/app/server/data", "/app/uploads"]

ENV PORT=3001
EXPOSE 3001

CMD ["node", "server/src/index.js"]
