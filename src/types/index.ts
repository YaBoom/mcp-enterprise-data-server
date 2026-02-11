// 通用类型定义

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

export interface RequestContext {
  userId: string;
  role: 'admin' | 'manager' | 'employee';
  requestId: string;
  timestamp: Date;
}

export interface MySQLConfig {
  host: string;
  user: string;
  password: string;
  database: string;
  connectionLimit?: number;
}

export interface RedisConfig {
  url: string;
}

export interface APIConfig {
  baseURL: string;
  token?: string;
  timeout?: number;
}
