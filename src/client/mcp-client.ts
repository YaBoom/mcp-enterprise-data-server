import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

interface MCPClientConfig {
  serverCommand: string;
  serverArgs: string[];
  modelProvider: 'openai' | 'anthropic' | 'deepseek';
  apiKey: string;
  modelName: string;
}

export class UnifiedMCPClient {
  private mcpClient!: Client;
  private modelClient: any;
  private config: MCPClientConfig;

  constructor(config: MCPClientConfig) {
    this.config = config;
    this.initModelClient();
  }

  private initModelClient() {
    switch (this.config.modelProvider) {
      case 'openai':
        this.modelClient = new OpenAI({ apiKey: this.config.apiKey });
        break;
      case 'anthropic':
        this.modelClient = new Anthropic({ apiKey: this.config.apiKey });
        break;
      case 'deepseek':
        this.modelClient = new OpenAI({
          apiKey: this.config.apiKey,
          baseURL: 'https://api.deepseek.com',
        });
        break;
    }
  }

  async connect() {
    // 启动MCP Server子进程
    const transport = new StdioClientTransport({
      command: this.config.serverCommand,
      args: this.config.serverArgs,
    });

    this.mcpClient = new Client(
      { name: 'unified-client', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    await this.mcpClient.connect(transport);
    console.log('Connected to MCP Server');
  }

  async chat(userMessage: string, userRole: string = 'employee') {
    // 1. 从MCP Server获取可用工具
    const toolsResponse = await this.mcpClient.listTools();
    const mcpTools = toolsResponse.tools;

    // 2. 转换为不同模型需要的格式
    const modelTools = this.adaptToolsToModel(mcpTools);

    // 3. 第一轮调用：让模型决定是否需要调用工具
    const initialResponse = await this.callModel([
      { role: 'system', content: '你是一个企业数据助手，可以通过工具查询数据库和API。' },
      { role: 'user', content: userMessage },
    ], modelTools);

    // 4. 检查是否需要调用工具
    const toolCalls = this.extractToolCalls(initialResponse);
    
    if (!toolCalls || toolCalls.length === 0) {
      return this.extractContent(initialResponse);
    }

    // 5. 执行工具调用
    const messages: any[] = [
      { role: 'user', content: userMessage },
      { role: 'assistant', content: null, tool_calls: toolCalls },
    ];

    for (const toolCall of toolCalls) {
      // 注入用户角色到参数中
      const args = JSON.parse(toolCall.function.arguments);
      args.userRole = userRole;

      const result = await this.mcpClient.callTool({
        name: toolCall.function.name,
        arguments: args,
      });
      const content = result.content as Array<{ type: string; text?: string }>;

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: content[0]?.text ?? '',
      });
    }

    // 6. 第二轮调用：让模型总结结果
    const finalResponse = await this.callModel([
      { role: 'system', content: '你是一个企业数据助手。' },
      ...messages,
    ]);

    return this.extractContent(finalResponse);
  }

  private adaptToolsToModel(mcpTools: any[]): any[] {
    // 统一转换为OpenAI格式（其他模型再转）
    return mcpTools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }

  private async callModel(messages: any[], tools?: any[]) {
    switch (this.config.modelProvider) {
      case 'openai':
        return this.modelClient.chat.completions.create({
          model: this.config.modelName,
          messages,
          tools,
          tool_choice: tools ? 'auto' : undefined,
        });
      case 'anthropic':
        return this.modelClient.messages.create({
          model: this.config.modelName,
          max_tokens: 4096,
          messages,
          tools: tools?.map(t => ({
            name: t.function.name,
            description: t.function.description,
            input_schema: t.function.parameters,
          })),
        });
      case 'deepseek':
        return this.modelClient.chat.completions.create({
          model: this.config.modelName,
          messages,
          tools,
        });
    }
  }

  private extractToolCalls(response: any): any[] {
    if (this.config.modelProvider === 'anthropic') {
      return response.content
        ?.filter((c: any) => c.type === 'tool_use')
        .map((c: any) => ({
          id: c.id,
          function: {
            name: c.name,
            arguments: JSON.stringify(c.input),
          },
        }));
    }
    return response.choices?.[0]?.message?.tool_calls;
  }

  private extractContent(response: any): string {
    if (this.config.modelProvider === 'anthropic') {
      return response.content
        ?.filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
        .join('');
    }
    return response.choices?.[0]?.message?.content;
  }
}
