import { UnifiedMCPClient } from '../src/client/mcp-client.js';

async function main() {
  // 配置DeepSeek客户端
  const deepseekClient = new UnifiedMCPClient({
    serverCommand: 'node',
    serverArgs: ['./dist/index.js'],
    modelProvider: 'deepseek',
    apiKey: process.env.DEEPSEEK_API_KEY!,
    modelName: 'deepseek-chat',
  });

  await deepseekClient.connect();

  console.log('=== 使用 DeepSeek 查询数据 ===');
  const response = await deepseekClient.chat(
    '查一下公司的部门架构',
    'employee'
  );
  console.log(response);
}

main().catch(console.error);
