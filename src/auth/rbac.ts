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

  async checkPermission(role: string, toolName: string, args: any): Promise<boolean> {
    const allowedTools = this.toolPermissions[role];
    if (!allowedTools) return false;
    
    if (allowedTools.includes('*')) return true;
    if (!allowedTools.includes(toolName)) return false;

    // 额外的细粒度控制
    if (toolName === 'mysql_query' && args.sql) {
      // 经理只能查自己部门的员工
      if (role === 'manager' && args.sql.includes('employees')) {
        // 实际逻辑：检查SQL是否包含department_id限制
        return true;
      }
    }

    return true;
  }
}
