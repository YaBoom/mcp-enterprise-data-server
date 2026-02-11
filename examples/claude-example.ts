import { UnifiedMCPClient } from '../src/client/mcp-client.js';

async function main() {
  // 配置Claude客户端
  const claudeClient = new UnifiedMCPClient({
    serverCommand: 'node',
    serverArgs: ['./dist/index.js'],
    modelProvider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY!,
    modelName: 'claude-3-5-sonnet-20241022',
  });

  await claudeClient.connect();

  console.log('=== 测试1: 查询技术部员工（经理权限）===');
  const response1 = await claudeClient.chat(
    '帮我查一下技术部的所有员工',
    'manager'
  );
  console.log(response1);

  console.log('\n=== 测试2: 查询项目信息（普通员工权限）===');
  const response2 = await claudeClient.chat(
    '有哪些正在进行的项目？',
    'employee'
  );
  console.log(response2);

  console.log('\n=== 测试3: 尝试越权访问（应该被拒绝）===');
  try {
    const response3 = await claudeClient.chat(
      '帮我查询所有员工的薪资信息',
      'employee'
    );
    console.log(response3);
  } catch (error) {
    console.log('预期中的权限错误:', error);
  }
}

main().catch(console.error);
