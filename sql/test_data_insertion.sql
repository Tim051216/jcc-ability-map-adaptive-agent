-- 测试数据插入验证
USE learning;

-- 设置字符集
SET NAMES utf8mb4;

-- 测试1: 插入学习路径
INSERT INTO learning_path (
    id, user_id, profile_id, path_name, path_desc, 
    status, path_type, total_nodes, completed_nodes, 
    progress_percentage, difficulty_level, adaptive_enabled
) VALUES (
    1, 1001, 1, 'Java Basic Learning Path', 'Learn Java from scratch', 
    1, 1, 5, 0, 
    0, 3, 1
);

-- 测试2: 插入路径节点
INSERT INTO path_node (
    id, path_id, user_id, node_name, node_desc, 
    node_order, node_type, stage_type, 
    knowledge_points, completion_criteria, 
    difficulty_level, status, is_locked
) VALUES (
    1, 1, 1001, 'Java Environment Setup', 'Learn how to install and configure Java', 
    1, 1, 1, 
    '["JDK", "IDE", "Environment Variables"]', '{"duration": 30, "resources": 2}', 
    2, 0, 0
);

-- 测试3: 插入节点资源
INSERT INTO node_resource (
    id, node_id, path_id, user_id, 
    resource_type, resource_id, resource_name, 
    is_required, resource_order, push_status
) VALUES (
    1, 1, 1, 1001, 
    'video', 101, 'Java Setup Video Tutorial', 
    1, 1, 0
);

-- 测试4: 插入学习进度
INSERT INTO learning_progress (
    id, path_id, node_id, user_id, 
    progress_type, progress_percentage, duration
) VALUES (
    1, 1, 1, 1001, 
    1, 0, 0
);

-- 测试5: 插入路径调整记录
INSERT INTO path_adjustment (
    id, path_id, user_id, 
    adjustment_type, trigger_reason, 
    adjustment_data, status
) VALUES (
    1, 1, 1001, 
    1, 'Auto optimization based on learning effect', 
    '{"action": "add_node", "reason": "need more practice"}', 0
);

-- 测试6: 插入资源推送记录
INSERT INTO resource_push (
    id, path_id, node_id, user_id, 
    push_type, push_title, push_content, 
    push_channel, push_status
) VALUES (
    1, 1, 1, 1001, 
    1, 'New Node Activated', 'A new learning node is available', 
    'system', 0
);

-- 测试7: 插入学习日历任务
INSERT INTO learning_calendar (
    id, user_id, path_id, node_id, 
    task_title, task_type, plan_date, 
    status, priority
) VALUES (
    1, 1001, 1, 1, 
    'Complete Java Environment Setup', 1, CURDATE(), 
    0, 2
);

-- 测试8: 插入学习统计
INSERT INTO learning_statistics (
    id, user_id, stat_date, 
    total_duration, completed_tasks, completed_nodes
) VALUES (
    1, 1001, CURDATE(), 
    0, 0, 0
);

-- 验证插入结果
SELECT 'learning_path' as table_name, COUNT(*) as record_count FROM learning_path
UNION ALL
SELECT 'path_node', COUNT(*) FROM path_node
UNION ALL
SELECT 'node_resource', COUNT(*) FROM node_resource
UNION ALL
SELECT 'learning_progress', COUNT(*) FROM learning_progress
UNION ALL
SELECT 'path_adjustment', COUNT(*) FROM path_adjustment
UNION ALL
SELECT 'resource_push', COUNT(*) FROM resource_push
UNION ALL
SELECT 'learning_calendar', COUNT(*) FROM learning_calendar
UNION ALL
SELECT 'learning_statistics', COUNT(*) FROM learning_statistics;

-- 测试阶梯式路径存储
SELECT 
    pn.node_order,
    pn.node_name,
    pn.stage_type,
    pn.difficulty_level,
    pn.status
FROM path_node pn
WHERE pn.path_id = 1
ORDER BY pn.node_order;

-- 测试进度追踪
SELECT 
    lp.path_name,
    lp.progress_percentage,
    lp.completed_nodes,
    lp.total_nodes
FROM learning_path lp
WHERE lp.id = 1;
