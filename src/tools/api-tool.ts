import axios, { AxiosInstance } from 'axios';

interface APIArgs {
  endpoint: string;
  method?: 'GET' | 'POST';
  params?: Record<string, any>;
}

export class APITool {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.API_BASE_URL || 'http://localhost:3001',
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.API_TOKEN || ''}`,
      },
    });

    // 响应拦截器 - 统一错误处理
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          throw new Error(`API Error ${error.response.status}: ${error.response.data?.message || 'Unknown'}`);
        }
        throw new Error(`Network Error: ${error.message}`);
      }
    );
  }

  async execute(args: APIArgs) {
    const { endpoint, method = 'GET', params = {} } = args;

    // 白名单检查
    const allowedEndpoints = ['/employees', '/departments', '/projects'];
    if (!allowedEndpoints.includes(endpoint)) {
      throw new Error(`未授权的API端点: ${endpoint}`);
    }

    try {
      const response = await this.client.request({
        url: endpoint,
        method,
        params: method === 'GET' ? params : undefined,
        data: method === 'POST' ? params : undefined,
      });

      return {
        success: true,
        endpoint,
        method,
        data: response.data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`API调用失败: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }
}
