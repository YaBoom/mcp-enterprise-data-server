import { UnifiedMCPClient } from '../src/client/mcp-client.js';

async function main() {
  // 配置OpenAI客户端
  const openaiClient = new UnifiedMCPClient({
    serverCommand: 'node',
    serverArgs: ['./dist/index.js'],
    modelProvider: 'openai',
    apiKey: process.env.OPENAI_API_KEY!,
    modelName: 'gpt-4o',
  });

  await openaiClient.connect();

  console.log('=== 使用 GPT-4o 查询数据 ===');
  const response = await openaiClient.chat(
    '统计一下销售部的业绩总额',
    'manager'
  );
  console.log(response);
}

main().catch(console.error);
