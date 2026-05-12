-- 测试创建学习路径表结构
-- 使用测试数据库避免影响现有数据

-- 创建测试数据库
DROP DATABASE IF EXISTS `tj_learning_test`;
CREATE DATABASE `tj_learning_test` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `tj_learning_test`;

-- 执行表创建脚本内容
SOURCE tj_learning_path.sql;

-- 验证表创建结果
SHOW TABLES;

-- 显示每个表的结构
SHOW CREATE TABLE learning_path\G
SHOW CREATE TABLE path_node\G
SHOW CREATE TABLE node_resource\G
SHOW CREATE TABLE learning_progress\G
SHOW CREATE TABLE path_adjustment\G
SHOW CREATE TABLE resource_push\G
SHOW CREATE TABLE learning_calendar\G
SHOW CREATE TABLE learning_statistics\G
