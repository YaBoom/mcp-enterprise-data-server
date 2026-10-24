import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 用 vi.hoisted 保证 mock 工厂能访问到这两个容器：
 * vi.mock 的工厂函数会被提升到文件顶部，普通变量这时还没初始化。
 */
const { executed, mockRows } = vi.hoisted(() => {
  const executed: Array<{ sql: string; params: unknown[] }> = [];
  const mockRows = [
    { id: 1, name: '张三', department: '技术部', password: 'p@ss', phone: '13800000000', salary: 20000 },
  ];
  return { executed, mockRows };
});

// 把 mysql2 换掉：不连真库，只记录驱动层实际收到的 SQL 与参数
vi.mock('mysql2/promise', () => {
  const createPool = () => ({
    execute: async (sql: string, params: unknown[] = []) => {
      executed.push({ sql, params });
      return [mockRows, []];
    },
  });
  return { default: { createPool }, createPool };
});

const { MySQLTool } = await import('./mysql-tool.js');

const tool = new MySQLTool();

beforeEach(() => {
  executed.length = 0;
});

/** 期望被拒绝，且错误信息命中关键词 */
async function expectRejected(args: Parameters<typeof tool.execute>[0], keyword: string) {
  await expect(tool.execute(args)).rejects.toThrow(keyword);
}

describe('工具级白名单', () => {
  it('employee 无权调用 mysql_query', async () => {
    await expectRejected({ sql: 'SELECT * FROM employees', userRole: 'employee' }, '无权调用 mysql_query');
    // 关键：被拒的时候不应该有 SQL 打到驱动层
    expect(executed).toHaveLength(0);
  });
});

describe('表级白名单', () => {
  it('manager 越权访问白名单外的表被拒', async () => {
    await expectRejected({ sql: 'SELECT * FROM audit_logs', userRole: 'manager' }, '无权访问表: audit_logs');
  });

  it('manager 访问白名单内的表放行', async () => {
    await expect(tool.execute({ sql: 'SELECT * FROM sales', userRole: 'manager' })).resolves.toBeTruthy();
  });

  it('admin 的通配 * 生效，可访问任意表', async () => {
    // 回归用例：白名单是 ['*'] 时，['*'].includes(table) 恒为 false，
    // 修之前管理员会被全部拒绝
    await expect(tool.execute({ sql: 'SELECT * FROM audit_logs', userRole: 'admin' })).resolves.toBeTruthy();
  });

  it('支持 db.table 与反引号形式', async () => {
    await expect(
      tool.execute({ sql: 'SELECT * FROM `erp`.`sales`', userRole: 'manager' })
    ).resolves.toBeTruthy();
  });
});

describe('只读语句硬化', () => {
  it('拒绝非 SELECT 语句', async () => {
    await expectRejected({ sql: "DELETE FROM employees WHERE id = 1", userRole: 'admin' }, '只允许执行 SELECT');
  });

  it('拒绝 SELECT ... INTO OUTFILE（写服务器文件）', async () => {
    await expectRejected(
      { sql: "SELECT * FROM employees INTO OUTFILE '/tmp/x'", userRole: 'admin' },
      'INTO OUTFILE'
    );
  });

  it('拒绝 SELECT ... INTO DUMPFILE', async () => {
    await expectRejected(
      { sql: "SELECT * FROM employees INTO DUMPFILE '/tmp/x'", userRole: 'admin' },
      'INTO OUTFILE / DUMPFILE'
    );
  });

  it('拒绝 FOR UPDATE（加行锁）', async () => {
    await expectRejected({ sql: 'SELECT * FROM employees FOR UPDATE', userRole: 'admin' }, 'FOR UPDATE');
  });

  it('拒绝 LOCK IN SHARE MODE（共享锁）', async () => {
    await expectRejected(
      { sql: 'SELECT * FROM employees LOCK IN SHARE MODE', userRole: 'admin' },
      'LOCK IN SHARE MODE'
    );
  });

  it('拒绝多语句堆叠', async () => {
    await expectRejected(
      { sql: 'SELECT * FROM employees; DROP TABLE employees', userRole: 'admin' },
      '多条语句'
    );
  });
});

describe('表名解析不误伤', () => {
  it('字符串字面量里的 from 不被当成表名', async () => {
    // 旧实现用 /from\\s+(\\w+)/ 直接扫原文，会把 'from sales' 里的 sales 当表名而误拒
    await expect(
      tool.execute({
        sql: "SELECT * FROM employees WHERE note = 'from sales'",
        userRole: 'manager',
      })
    ).resolves.toBeTruthy();
  });

  it('注释里的 from 不被当成表名', async () => {
    await expect(
      tool.execute({
        sql: 'SELECT * FROM employees /* from sales */ LIMIT 1',
        userRole: 'manager',
      })
    ).resolves.toBeTruthy();
  });
});

describe('参数化绑定', () => {
  it('占位符与参数数量不一致时直接拒绝', async () => {
    await expectRejected(
      { sql: 'SELECT * FROM employees WHERE name = ?', params: [], userRole: 'manager' },
      '不一致'
    );
  });

  it('参数按原样传给驱动，不拼进 SQL 文本', async () => {
    await tool.execute({
      sql: 'SELECT name FROM employees WHERE department = ? LIMIT ?',
      params: ['技术部', 10],
      userRole: 'manager',
    });

    expect(executed).toHaveLength(1);
    expect(executed[0].params).toEqual(['技术部', 10]);
    // 值只存在于 params，SQL 模板里不应出现
    expect(executed[0].sql).not.toContain('技术部');
  });
});

describe('结果处理', () => {
  it('敏感字段脱敏，普通字段保留', async () => {
    const result = await tool.execute({ sql: 'SELECT * FROM employees', userRole: 'manager' });
    const row = (result.data as any[])[0];

    expect(row.name).toBe('张三');
    expect(row.department).toBe('技术部');
    expect(row.password).toBe('***');
    expect(row.phone).toBe('***');
    expect(row.salary).toBe('***');
  });

  it('admin 不做脱敏', async () => {
    const result = await tool.execute({ sql: 'SELECT * FROM employees', userRole: 'admin' });
    const row = (result.data as any[])[0];

    expect(row.password).toBe('p@ss');
    expect(row.salary).toBe(20000);
  });

  it('executionTimeMs 是耗时而非时间戳', async () => {
    const result = await tool.execute({ sql: 'SELECT * FROM employees', userRole: 'manager' });

    // 修 bug 前这里返回的是 Date.now()，量级恒为 1.7e12
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.executionTimeMs).toBeLessThan(5000);
  });
});
