import mysql from 'mysql2/promise';
import { RBAC } from '../auth/rbac.js';

interface MySQLArgs {
  sql: string;
  userRole: string;
}

export class MySQLTool {
  private pool: mysql.Pool;
  private rbac: RBAC;

  constructor() {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
    this.rbac = new RBAC();
  }

  async execute(args: MySQLArgs) {
    const { sql, userRole } = args;

    // 安全检查1：只允许SELECT语句
    const normalizedSQL = sql.trim().toLowerCase();
    if (!normalizedSQL.startsWith('select')) {
      throw new Error('只允许执行SELECT查询语句');
    }

    // 安全检查2：基于角色的表访问控制
    const allowedTables = this.rbac.getAllowedTables(userRole);
    const accessedTables = this.extractTables(sql);
    
    for (const table of accessedTables) {
      if (!allowedTables.includes(table)) {
        throw new Error(`角色 ${userRole} 无权访问表: ${table}`);
      }
    }

    // 安全检查3：敏感字段脱敏
    const sensitiveFields = ['password', 'id_card', 'phone', 'salary'];
    
    try {
      const [rows] = await this.pool.execute(sql);
      
      // 自动脱敏处理
      const sanitizedRows = this.sanitizeData(rows, sensitiveFields, userRole);
      
      return {
        success: true,
        rowCount: Array.isArray(rows) ? rows.length : 0,
        data: sanitizedRows,
        executionTime: Date.now(),
      };
    } catch (error) {
      throw new Error(`查询执行失败: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  private extractTables(sql: string): string[] {
    // 简单的表名提取（生产环境用SQL Parser）
    const regex = /from\s+(\w+)|join\s+(\w+)/gi;
    const tables: string[] = [];
    let match;
    while ((match = regex.exec(sql)) !== null) {
      tables.push(match[1] || match[2]);
    }
    return tables;
  }

  private sanitizeData(data: any, sensitiveFields: string[], userRole: string): any {
    if (userRole === 'admin') return data; // admin看全部
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item, sensitiveFields, userRole));
    }
    
    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (sensitiveFields.includes(key.toLowerCase())) {
          sanitized[key] = '***'; // 脱敏显示
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }
    
    return data;
  }
}
