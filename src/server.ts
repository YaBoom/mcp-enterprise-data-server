import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { MySQLTool } from './tools/mysql-tool.js';
import { RedisTool } from './tools/redis-tool.js';
import { APITool } from './tools/api-tool.js';
import { RBAC } from './auth/rbac.js';

export class DataMcpServer {
  private server: Server;
  private tools: Map<string, any>;
  private rbac: RBAC;

  constructor() {
    // 初始化MCP Server
    this.server = new Server(
      {
        name: 'enterprise-data-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {}, // 声明支持tools能力
        },
      }
    );

    this.tools = new Map();
    this.rbac = new RBAC();
    
    this.registerTools();
    this.setupHandlers();
  }

  private registerTools() {
    // 注册所有工具
    this.tools.set('mysql_query', new MySQLTool());
    this.tools.set('redis_get', new RedisTool());
    this.tools.set('api_call', new APITool());
  }

  private setupHandlers() {
    // 处理"列出可用工具"请求
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = [
        {
          name: 'mysql_query',
          description:
            '执行 MySQL 只读查询：仅单条 SELECT，条件值走 ? 占位符绑定，按角色做表级权限与敏感字段脱敏',
          inputSchema: {
            type: 'object',
            properties: {
              sql: {
                type: 'string',
                description:
                  '单条 SELECT 查询语句。条件值必须写成 ? 占位符，不要拼接字面量；占位符数量需与 params 长度一致',
              },
              params: {
                type: 'array',
                description:
                  '与 sql 中 ? 占位符一一对应的参数值（字符串/数字/布尔/null），由驱动预编译绑定，不参与 SQL 文本拼接',
              },
              userRole: {
                type: 'string',
                enum: ['admin', 'manager', 'employee'],
                description: '当前用户角色，用于权限控制',
              },
            },
            required: ['sql', 'userRole'],
          },
        },
        {
          name: 'redis_get',
          description: '从Redis获取缓存数据',
          inputSchema: {
            type: 'object',
            properties: {
              key: {
                type: 'string',
                description: 'Redis键名',
              },
            },
            required: ['key'],
          },
        },
        {
          name: 'api_call',
          description: '调用内部API（员工信息、部门架构等）',
          inputSchema: {
            type: 'object',
            properties: {
              endpoint: {
                type: 'string',
                enum: ['/employees', '/departments', '/projects'],
                description: 'API端点',
              },
              method: {
                type: 'string',
                enum: ['GET', 'POST'],
                default: 'GET',
              },
              params: {
                type: 'object',
                description: '查询参数',
              },
            },
            required: ['endpoint'],
          },
        },
      ];

      return { tools };
    });

    // 处理"调用工具"请求
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name } = request.params;
      const args = (request.params.arguments ?? {}) as Record<string, any>;
      
      // 权限检查
      const hasPermission = await this.rbac.checkPermission(
        args.userRole || 'employee',
        name,
        args
      );
      
      if (!hasPermission) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'PERMISSION_DENIED',
                message: '当前用户角色无权执行此操作',
              }),
            },
          ],
        };
      }

      // 执行工具
      const tool = this.tools.get(name);
      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }

      try {
        const result = await tool.execute(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'EXECUTION_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error',
              }),
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP Server running on stdio');
  }
}
