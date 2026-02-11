# 使用示例

本目录包含各种使用场景的示例代码。

## 前置要求

1. 确保已安装依赖：`npm install`
2. 确保已构建项目：`npm run build`
3. 配置好相应的 API Key 环境变量

## 运行示例

### Claude (Anthropic)

```bash
export ANTHROPIC_API_KEY=your-key
npx tsx examples/claude-example.ts
```

### OpenAI (GPT-4o)

```bash
export OPENAI_API_KEY=your-key
npx tsx examples/openai-example.ts
```

### DeepSeek

```bash
export DEEPSEEK_API_KEY=your-key
npx tsx examples/deepseek-example.ts
```

## 示例说明

- `claude-example.ts` - 展示 Claude 模型的接入，包含权限测试
- `openai-example.ts` - 展示 GPT-4o 的接入
- `deepseek-example.ts` - 展示 DeepSeek 的接入

## 自定义示例

可以参考上述示例创建自己的客户端：

```typescript
import { UnifiedMCPClient } from './client/mcp-client.js';

const client = new UnifiedMCPClient({
  serverCommand: 'node',
  serverArgs: ['./dist/index.js'],
  modelProvider: 'anthropic', // 或 'openai', 'deepseek'
  apiKey: 'your-api-key',
  modelName: 'claude-3-5-sonnet-20241022',
});

await client.connect();
const response = await client.chat('你的问题', 'userRole');
```
