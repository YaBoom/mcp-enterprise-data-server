import { createClient, RedisClientType } from 'redis';

interface RedisArgs {
  key: string;
}

export class RedisTool {
  private client: RedisClientType;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    
    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });
  }

  async execute(args: RedisArgs) {
    const { key } = args;

    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const value = await this.client.get(key);
      
      if (value === null) {
        return {
          success: true,
          exists: false,
          message: `Key '${key}' not found`,
        };
      }

      // 尝试解析JSON
      let parsedValue;
      try {
        parsedValue = JSON.parse(value);
      } catch {
        parsedValue = value; // 如果不是JSON，返回原始字符串
      }

      return {
        success: true,
        exists: true,
        key,
        value: parsedValue,
        type: typeof parsedValue,
      };
    } catch (error) {
      throw new Error(`Redis操作失败: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }
}
