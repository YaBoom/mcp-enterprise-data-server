-- 初始化数据库脚本
-- 用于 Docker Compose 启动时自动创建测试数据

CREATE DATABASE IF NOT EXISTS enterprise_db;
USE enterprise_db;

-- 员工表
CREATE TABLE IF NOT EXISTS employees (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    department VARCHAR(50),
    position VARCHAR(50),
    salary DECIMAL(10, 2),
    phone VARCHAR(20),
    id_card VARCHAR(18),
    password VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 部门表
CREATE TABLE IF NOT EXISTS departments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    manager_id INT,
    budget DECIMAL(15, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 项目表
CREATE TABLE IF NOT EXISTS projects (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    department_id INT,
    status VARCHAR(20),
    budget DECIMAL(15, 2),
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 销售表
CREATE TABLE IF NOT EXISTS sales (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_name VARCHAR(100),
    amount DECIMAL(10, 2),
    quantity INT,
    sale_date DATE,
    salesperson_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入测试数据
INSERT INTO departments (name, manager_id, budget) VALUES
('技术部', 1, 5000000),
('销售部', 2, 3000000),
('人事部', 3, 1000000);

INSERT INTO employees (name, email, department, position, salary, phone, id_card, password) VALUES
('张三', 'zhangsan@company.com', '技术部', '高级工程师', 25000.00, '13800138001', '110101199001011234', 'hashed_password_1'),
('李四', 'lisi@company.com', '技术部', '前端工程师', 20000.00, '13800138002', '110101199002021234', 'hashed_password_2'),
('王五', 'wangwu@company.com', '销售部', '销售经理', 22000.00, '13800138003', '110101199003031234', 'hashed_password_3'),
('赵六', 'zhaoliu@company.com', '人事部', 'HR专员', 15000.00, '13800138004', '110101199004041234', 'hashed_password_4');

INSERT INTO projects (name, department_id, status, budget, start_date, end_date) VALUES
('AI平台开发', 1, '进行中', 2000000, '2026-01-01', '2026-12-31'),
('客户管理系统', 1, '已完成', 800000, '2025-06-01', '2025-12-01'),
('年度销售计划', 2, '进行中', 500000, '2026-01-01', '2026-06-30');

INSERT INTO sales (product_name, amount, quantity, sale_date, salesperson_id) VALUES
('企业版SaaS', 50000.00, 10, '2026-01-15', 3),
('定制开发服务', 120000.00, 1, '2026-01-20', 3),
('技术支持包', 8000.00, 20, '2026-02-01', 3);
