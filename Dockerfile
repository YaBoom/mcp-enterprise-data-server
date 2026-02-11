# Dockerfile
FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制构建产物
COPY dist ./dist

# 环境变量默认值
ENV DB_HOST=localhost
ENV DB_USER=root
ENV DB_PASSWORD=
ENV DB_NAME=
ENV REDIS_URL=redis://localhost:6379
ENV API_BASE_URL=http://localhost:3001
ENV API_TOKEN=

# 非root用户运行
USER node

# 启动命令
CMD ["node", "./dist/index.js"]
