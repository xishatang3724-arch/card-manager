# ===== 构建阶段：编译前端 =====
FROM node:20-alpine AS builder

WORKDIR /app
COPY client/ ./client/
RUN cd client && npm install && npm run build

# ===== 运行阶段：后端 + 前端静态文件 =====
FROM node:20-alpine

WORKDIR /app

# 复制后端代码
COPY server/ ./server/
RUN cd server && npm install --production

# 复制前端构建产物
COPY --from=builder /app/client/dist ./client/dist

# 数据目录持久化
VOLUME ["/app/server/data", "/app/uploads"]

ENV PORT=3001
EXPOSE 3001

CMD ["node", "server/src/index.js"]
