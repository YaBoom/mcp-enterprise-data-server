import mysql from 'mysql2/promise';
import { RBAC } from '../auth/rbac.js';

/** 允许绑定的参数类型；mysql2 会按类型做预编译绑定，不参与 SQL 文本拼接 */
export type SQLParam = string | number | boolean | null | Date;

interface MySQLArgs {
  sql: string;
  /** 与 sql 中 ? 占位符一一对应的参数值 */
  params?: SQLParam[];
  userRole: string;
}

/** SELECT 之下仍然带副作用、或能绕过只读边界的写法 */
const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\binto\s+(outfile|dumpfile)\b/i, reason: '禁止 SELECT ... INTO OUTFILE / DUMPFILE（会写服务器文件）' },
  { pattern: /\bfor\s+update\b/i, reason: '禁止 FOR UPDATE（会加行锁）' },
  { pattern: /\block\s+in\s+share\s+mode\b/i, reason: '禁止 LOCK IN SHARE MODE（会加共享锁）' },
  { pattern: /;\s*\S/, reason: '禁止一次提交多条语句' },
];

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
    const { sql, params = [], userRole } = args;

    if (typeof sql !== 'string' || sql.trim() === '') {
      throw new Error('sql 不能为空');
    }

    // 安全检查0：工具级白名单。server 层已拦过一次，这里做纵深防御，
    // 避免 MySQLTool 被单独复用（脚本/测试）时 employee 绕过工具白名单
    if (!(await this.rbac.checkPermission(userRole, 'mysql_query'))) {
      throw new Error(`角色 ${userRole} 无权调用 mysql_query`);
    }

    // 校验前先剥离字符串字面量与注释，避免 'from sales' 这类内容
    // 或被注释掉的片段干扰下面的语法判断
    const cleanSQL = this.stripLiteralsAndComments(sql);
    const normalizedSQL = cleanSQL.trim().toLowerCase();

    // 安全检查1：只允许单条 SELECT 语句
    if (!/^select\b/.test(normalizedSQL)) {
      throw new Error('只允许执行 SELECT 查询语句');
    }

    // 安全检查2：SELECT 形态下的写文件、加锁与多语句
    for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
      if (pattern.test(cleanSQL)) {
        throw new Error(reason);
      }
    }

    // 安全检查3：占位符必须与参数一一对应，防止条件值被拼进 SQL 文本
    const placeholderCount = (cleanSQL.match(/\?/g) ?? []).length;
    if (placeholderCount !== params.length) {
      throw new Error(
        `占位符数量(${placeholderCount})与参数数量(${params.length})不一致：条件值请用 ? 占位符并通过 params 传入`
      );
    }

    // 安全检查4：基于角色的表访问控制
    const accessedTables = this.extractTables(cleanSQL);

    for (const table of accessedTables) {
      if (!this.rbac.hasTableAccess(userRole, table)) {
        throw new Error(`角色 ${userRole} 无权访问表: ${table}`);
      }
    }

    // 安全检查5：敏感字段脱敏
    const sensitiveFields = ['password', 'id_card', 'phone', 'salary'];
    const startedAt = Date.now();

    try {
      // 参数化执行：SQL 模板与绑定值分开交给驱动，由 mysql2 预编译
      const [rows] = await this.pool.execute(sql, params);

      // 自动脱敏处理
      const sanitizedRows = this.sanitizeData(rows, sensitiveFields, userRole);

      return {
        success: true,
        rowCount: Array.isArray(rows) ? rows.length : 0,
        data: sanitizedRows,
        executionTimeMs: Date.now() - startedAt,
      };
    } catch (error) {
      throw new Error(`查询执行失败: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  /**
   * 剥离字符串字面量与注释，只保留可解析的 SQL 骨架。
   * 不这么做的话，WHERE name = 'from sales' 会被误判成访问了 sales 表。
   */
  private stripLiteralsAndComments(sql: string): string {
    return sql
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(--|#)[^\n]*/g, ' ')
      .replace(/'(?:[^'\\]|\\.|'')*'/g, "''")
      .replace(/"(?:[^"\\]|\\.|"")*"/g, '""');
  }

  private extractTables(cleanSQL: string): string[] {
    // 只认 FROM / JOIN 后紧跟的标识符，支持 `db`.`table` 与反引号包裹
    const regex = /\b(?:from|join)\s+[`"]?(?:\w+[`"]?\s*\.\s*[`"]?)?(\w+)[`"]?/gi;
    const tables = new Set<string>();
    let match;
    while ((match = regex.exec(cleanSQL)) !== null) {
      tables.add(match[1]);
    }
    return [...tables];
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
