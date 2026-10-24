export class RBAC {
  // 角色-表权限映射
  private tablePermissions: Record<string, string[]> = {
    admin: ['*'], // 所有表
    manager: ['employees', 'departments', 'projects', 'sales'],
    employee: ['employees', 'departments', 'projects'],
  };

  // 角色-工具权限映射
  private toolPermissions: Record<string, string[]> = {
    admin: ['mysql_query', 'redis_get', 'api_call'],
    manager: ['mysql_query', 'redis_get', 'api_call'],
    employee: ['redis_get', 'api_call'], // 普通员工不能直连MySQL
  };

  getAllowedTables(role: string): string[] {
    return this.tablePermissions[role] || [];
  }

  /**
   * 判断角色是否有权访问某张表。
   * 注意：admin 的白名单是 ['*']，必须先判通配再比较表名，
   * 否则 ['*'].includes('employees') 恒为 false，管理员会被全部拒绝。
   */
  hasTableAccess(role: string, table: string): boolean {
    const allowed = this.getAllowedTables(role);
    if (allowed.length === 0) return false;
    if (allowed.includes('*')) return true;
    return allowed.some((t) => t.toLowerCase() === table.toLowerCase());
  }

  async checkPermission(role: string, toolName: string, _args?: any): Promise<boolean> {
    const allowedTools = this.toolPermissions[role];
    if (!allowedTools) return false;

    return allowedTools.includes(toolName);
  }
}
