# MCP Enterprise Data Server

基于 [Model Context Protocol (MCP)](https://modelcontextprotocol.io) 的企业级数据查询服务。让 AI Agent 安全地访问 MySQL、Redis 和内部 API。

## 🚀 特性

- **多模型支持**: Claude、GPT-4o、DeepSeek 统一接入，OpenAI / Anthropic 两套 tool schema 双向转换
- **工具级 RBAC**: 角色 → 工具白名单（employee 无法调用 `mysql_query`）+ 角色 → 表白名单
- **数据安全**: 单条 SELECT 校验 + 参数化查询（`?` 占位符绑定）+ 敏感字段脱敏
- **只读硬化**: 拦截 `INTO OUTFILE / DUMPFILE`、`FOR UPDATE`、`LOCK IN SHARE MODE` 与多语句堆叠
- **连接池复用**: mysql2 连接池（connectionLimit 10），Redis 单连接复用

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

执行 MySQL 只读查询（仅支持单条 SELECT）。

最简写法（无参数时可直接查）：

```json
{
  "sql": "SELECT name, department FROM employees LIMIT 10",
  "userRole": "manager"
}
```

推荐写法（参数化，条件值走 `params` 绑定）：

```json
{
  "sql": "SELECT name, department FROM employees WHERE department = ? LIMIT ?",
  "params": ["技术部", 10],
  "userRole": "manager"
}
```

`sql` 中 `?` 的数量必须与 `params` 长度一致，否则直接拒绝——这是防止条件值被拼进 SQL 文本的那道闸。

**权限控制**:
- `admin`: 可访问所有表（白名单为 `*` 通配）
- `manager`: 可访问 employees、departments、projects、sales
- `employee`: 无 MySQL 访问权限，工具白名单就不含 `mysql_query`

**敏感字段自动脱敏**:
- password、id_card、phone、salary 等字段在返回前替换为 `***`（`admin` 除外）

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
├── monitoring/           # 监控配置（预留骨架，未接入埋点）
│   └── prometheus.yml
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

## 🔐 安全说明

1. **参数化查询**: 条件值通过 `?` 占位符 + `params` 数组交给 mysql2 预编译绑定，不做字符串拼接；占位符与参数数量不一致直接拒绝
2. **只读语句硬化**: 仅允许单条 SELECT；拦截 `INTO OUTFILE / DUMPFILE`、`FOR UPDATE`、`LOCK IN SHARE MODE` 与多语句堆叠
3. **表级权限控制**: 从 SQL 解析表名后按角色白名单校验；解析前先剥离字符串字面量与注释，避免 `WHERE note = 'from sales'` 被误判成访问了 sales 表
4. **字段脱敏**: password / id_card / phone / salary 在返回前替换为 `***`（admin 除外）
5. **工具白名单**: employee 在 server 层与工具层双重被拒，无法调用 `mysql_query`

<b>已知边界</b>：表名校验是正则实现，不是完整 SQL Parser。`UNION`、子查询、`db.table` 形式能覆盖，但复杂 CTE / 动态拼接不保证；生产环境应换成 AST 解析并叠加数据库只读账号。

## 📊 监控（预留，未接入）

`monitoring/prometheus.yml` 与 `docker-compose.yml` 里的 Prometheus / Grafana 是**预留骨架**，不是已完成的监控：

- 服务走 stdio 传输，没有 HTTP 端口，也未暴露 `/metrics`
- `prometheus.yml` 里 `mcp-server:3000` 这个 target 目前抓不到任何数据，容器起来后指标为空
- `src/` 中没有 `prom-client` 埋点

后续接入时按以下指标设计（**当前是设计稿，非已实现**）：

| 指标名 | 说明 |
|--------|------|
| `mcp_tool_calls_total` | 工具调用总数（按 tool / role 打标签） |
| `mcp_tool_call_duration_seconds` | 工具调用耗时直方图 |
| `mcp_permission_denied_total` | 权限拒绝次数（按 tool / role） |

接入步骤：新增 HTTP `/metrics` 端口 → 改 `monitoring/prometheus.yml` 的 target 指向该端口 → 在 Grafana 里建面板。

> 如果只是跑通功能，可以把 `docker-compose.yml` 里的 `prometheus` / `grafana` 两个服务注释掉，能省两个容器。

## 🧪 测试

```bash
npm test            # 单次运行
npm run test:watch  # 监听模式
```

18 条用例，用 `vi.mock` 把 mysql2 换成假驱动，**不需要真实数据库**：

| 分组 | 覆盖内容 |
|------|----------|
| 工具级白名单 | employee 被拒且不产生任何 SQL 调用 |
| 表级白名单 | manager 越权被拒、白名单内放行、admin 通配 `*`、`db.table` 形式 |
| 只读硬化 | 非 SELECT、`INTO OUTFILE / DUMPFILE`、`FOR UPDATE`、`LOCK IN SHARE MODE`、多语句堆叠 |
| 表名解析 | 字符串字面量与注释里的 `from` 不被误判为表名 |
| 参数化绑定 | 占位符/参数数量不一致被拒；参数原样传到驱动且不出现在 SQL 文本里 |
| 结果处理 | 敏感字段脱敏、admin 不脱敏、`executionTimeMs` 是耗时而非时间戳 |

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
