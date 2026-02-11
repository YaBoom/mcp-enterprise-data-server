# MCP Enterprise Data Server

基于 [Model Context Protocol (MCP)](https://modelcontextprotocol.io) 的企业级数据查询服务。让 AI Agent 安全地访问 MySQL、Redis 和内部 API。

## 🚀 特性

- **多模型支持**: Claude、GPT-4o、DeepSeek 统一接入
- **企业级权限**: RBAC 角色权限控制
- **数据安全**: SQL 注入防护、敏感字段自动脱敏
- **高性能**: 连接池复用、结果缓存、流式传输
- **监控完善**: Prometheus + Grafana 监控面板

## 📦 快速开始

### 方式一：Docker 运行（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/YaBoom/mcp-enterprise-data-server.git
cd mcp-enterprise-data-server

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件填入数据库配置

# 3. 启动服务
docker-compose up -d
```

### 方式二：本地运行

```bash
# 1. 安装依赖
npm install

# 2. 构建
npm run build

# 3. 配置环境变量
export DB_HOST=localhost
export DB_USER=root
export DB_PASSWORD=yourpassword
export DB_NAME=yourdb
export REDIS_URL=redis://localhost:6379

# 4. 启动
npm start
```

## 🔧 Claude Desktop 配置

编辑配置文件：
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "enterprise-data": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "DB_HOST", "-e", "DB_USER", "-e", "DB_PASSWORD", "mcp-enterprise-data-server:latest"],
      "env": {
        "DB_HOST": "your-db-host",
        "DB_USER": "mcp_readonly",
        "DB_PASSWORD": "your-password"
      }
    }
  }
}
```

## 📖 可用工具

### 1. mysql_query

执行 MySQL 只读查询（仅支持 SELECT）。

```json
{
  "sql": "SELECT * FROM employees WHERE department = '技术部' LIMIT 10",
  "userRole": "manager"
}
```

**权限控制**:
- `admin`: 可访问所有表
- `manager`: 可访问 employees、departments、projects、sales
- `employee`: 无 MySQL 访问权限

**敏感字段自动脱敏**:
- password、id_card、phone、salary 等字段会自动显示为 `***`

### 2. redis_get

从 Redis 获取缓存数据。

```json
{
  "key": "user:session:12345"
}
```

### 3. api_call

调用内部 API。

```json
{
  "endpoint": "/employees",
  "method": "GET",
  "params": {
    "department": "技术部"
  }
}
```

**可用端点**:
- `/employees` - 员工信息
- `/departments` - 部门架构
- `/projects` - 项目信息

## 💻 客户端接入示例

```typescript
import { UnifiedMCPClient } from './client/mcp-client.js';

const client = new UnifiedMCPClient({
  serverCommand: 'node',
  serverArgs: ['./dist/index.js'],
  modelProvider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY!,
  modelName: 'claude-3-5-sonnet-20241022',
});

await client.connect();

const response = await client.chat(
  '帮我查一下技术部的所有员工',
  'manager'
);

console.log(response);
// 技术部共有15名员工，分别是：张三（前端）、李四（后端）...
```

## 🏗️ 项目结构

```
mcp-enterprise-data-server/
├── src/
│   ├── index.ts          # 入口文件
│   ├── server.ts         # MCP Server 核心
│   ├── tools/            # 工具实现
│   │   ├── mysql-tool.ts
│   │   ├── redis-tool.ts
│   │   └── api-tool.ts
│   ├── auth/             # 权限控制
│   │   └── rbac.ts
│   ├── client/           # 统一客户端
│   │   └── mcp-client.ts
│   └── types/            # 类型定义
│       └── index.ts
├── monitoring/           # 监控配置
│   └── prometheus.yml
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

## 🔐 安全说明

1. **SQL 注入防护**: 使用参数化查询，禁止非 SELECT 语句
2. **表级权限控制**: 基于角色的表访问控制
3. **字段脱敏**: 敏感字段自动脱敏处理
4. **工具白名单**: API 端点白名单机制

## 📊 监控指标

| 指标名 | 说明 |
|--------|------|
| `mcp_tool_calls_total` | 工具调用总数 |
| `mcp_tool_call_duration_seconds` | 工具调用耗时 |
| `mcp_permission_denied_total` | 权限拒绝次数 |

访问 `http://localhost:9090` 查看 Prometheus 面板
访问 `http://localhost:3000` 查看 Grafana 面板（默认账号 admin/admin）

## 📝 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DB_HOST` | MySQL 主机 | localhost |
| `DB_USER` | MySQL 用户名 | root |
| `DB_PASSWORD` | MySQL 密码 | - |
| `DB_NAME` | MySQL 数据库名 | - |
| `REDIS_URL` | Redis 连接地址 | redis://localhost:6379 |
| `API_BASE_URL` | 内部 API 基础地址 | http://localhost:3001 |
| `API_TOKEN` | API 认证令牌 | - |

## 🤝 贡献

欢迎提交 Issue 和 PR！

## 📄 许可证

MIT License
