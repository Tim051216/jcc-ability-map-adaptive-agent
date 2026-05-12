-- 验证学习路径表结构脚本
-- 此脚本用于验证所有表是否创建成功

-- 创建测试数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS `tj_learning` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `tj_learning`;

-- 执行主脚本
SOURCE f:/A3-cnsoftbei/a3-learning-agent-system/sql/tj_learning_path.sql;

-- 验证所有表是否创建成功
SELECT 
    '验证表结构' AS verification_step,
    COUNT(*) AS table_count
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'tj_learning' 
AND TABLE_NAME IN (
    'learning_path',
    'path_node',
    'node_resource',
    'learning_progress',
    'path_adjustment',
    'resource_push',
    'learning_calendar',
    'learning_statistics'
);

-- 验证每个表的详细信息
SELECT 
    TABLE_NAME AS table_name,
    TABLE_COMMENT AS table_comment,
    ENGINE AS engine,
    TABLE_COLLATION AS collation
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'tj_learning' 
AND TABLE_NAME IN (
    'learning_path',
    'path_node',
    'node_resource',
    'learning_progress',
    'path_adjustment',
    'resource_push',
    'learning_calendar',
    'learning_statistics'
)
ORDER BY TABLE_NAME;

-- 验证索引创建情况
SELECT 
    TABLE_NAME AS table_name,
    INDEX_NAME AS index_name,
    COLUMN_NAME AS column_name,
    INDEX_TYPE AS index_type
FROM information_schema.STATISTICS 
WHERE TABLE_SCHEMA = 'tj_learning' 
AND TABLE_NAME IN (
    'learning_path',
    'path_node',
    'node_resource',
    'learning_progress',
    'path_adjustment',
    'resource_push',
    'learning_calendar',
    'learning_statistics'
)
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- 验证字段数量
SELECT 
    TABLE_NAME AS table_name,
    COUNT(*) AS column_count
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'tj_learning' 
AND TABLE_NAME IN (
    'learning_path',
    'path_node',
    'node_resource',
    'learning_progress',
    'path_adjustment',
    'resource_push',
    'learning_calendar',
    'learning_statistics'
)
GROUP BY TABLE_NAME
ORDER BY TABLE_NAME;
