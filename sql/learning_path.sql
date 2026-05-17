/*
 个性化学习路径规划系统数据库设计
 Database: learning
 Description: 学习路径规划、节点管理、进度跟踪相关表结构
*/

USE `learning`;

-- ========================================
-- 学习路径主表
-- ========================================
DROP TABLE IF EXISTS `learning_path`;
CREATE TABLE IF NOT EXISTS `learning_path` (
  `id` bigint NOT NULL COMMENT '路径ID',
  `user_id` bigint NOT NULL COMMENT '学生用户ID',
  `profile_id` bigint DEFAULT NULL COMMENT '关联的学生画像ID',
  
  -- 路径基本信息
  `path_name` varchar(256) NOT NULL COMMENT '路径名称',
  `path_desc` text DEFAULT NULL COMMENT '路径描述',
  `target_course_id` bigint DEFAULT NULL COMMENT '目标课程ID',
  `target_knowledge_points` json DEFAULT NULL COMMENT '目标知识点列表',
  
  -- 路径状态
  `status` tinyint NOT NULL DEFAULT 0 COMMENT '路径状态：0-草稿，1-已激活，2-进行中，3-已完成，4-已暂停，5-已废弃',
  `path_type` tinyint NOT NULL DEFAULT 1 COMMENT '路径类型：1-AI自动规划，2-教师指定，3-混合模式',
  
  -- 路径统计
  `total_nodes` int NOT NULL DEFAULT 0 COMMENT '总节点数',
  `completed_nodes` int NOT NULL DEFAULT 0 COMMENT '已完成节点数',
  `current_node_id` bigint DEFAULT NULL COMMENT '当前节点ID',
  
  -- 路径进度
  `progress_percentage` tinyint NOT NULL DEFAULT 0 COMMENT '完成百分比(0-100)',
  `estimated_duration` int DEFAULT NULL COMMENT '预估总时长（分钟）',
  `actual_duration` int NOT NULL DEFAULT 0 COMMENT '实际学习时长（分钟）',
  
  -- 路径难度
  `difficulty_level` tinyint NOT NULL DEFAULT 3 COMMENT '整体难度等级：1-入门，2-初级，3-中级，4-高级，5-专家',
  `adaptive_enabled` bit(1) NOT NULL DEFAULT b'1' COMMENT '是否启用自适应调整',
  
  -- 时间戳
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `activate_time` datetime DEFAULT NULL COMMENT '激活时间',
  `start_time` datetime DEFAULT NULL COMMENT '开始学习时间',
  `complete_time` datetime DEFAULT NULL COMMENT '完成时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_profile_id` (`profile_id`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_create_time` (`create_time`) USING BTREE,
  KEY `idx_current_node` (`current_node_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学习路径主表';


-- ========================================
-- 路径节点表
-- ========================================
DROP TABLE IF EXISTS `path_node`;
CREATE TABLE IF NOT EXISTS `path_node` (
  `id` bigint NOT NULL COMMENT '节点ID',
  `path_id` bigint NOT NULL COMMENT '所属路径ID',
  `user_id` bigint NOT NULL COMMENT '学生用户ID',
  
  -- 节点基本信息
  `node_name` varchar(256) NOT NULL COMMENT '节点名称',
  `node_desc` text DEFAULT NULL COMMENT '节点描述',
  `node_order` int NOT NULL COMMENT '节点顺序（从1开始）',
  
  -- 节点类型
  `node_type` tinyint NOT NULL COMMENT '节点类型：1-学习节点，2-练习节点，3-测评节点，4-复习节点',
  `stage_type` tinyint NOT NULL DEFAULT 1 COMMENT '阶段类型：1-基础阶段，2-进阶阶段，3-高级阶段，4-综合阶段',
  
  -- 知识点关联
  `knowledge_points` json DEFAULT NULL COMMENT '关联的知识点列表',
  `prerequisite_nodes` json DEFAULT NULL COMMENT '前置节点ID列表',
  
  -- 节点难度
  `difficulty_level` tinyint NOT NULL DEFAULT 3 COMMENT '难度等级：1-入门，2-初级，3-中级，4-高级，5-专家',
  
  -- 完成条件
  `completion_criteria` json NOT NULL COMMENT '完成条件配置（如：学习时长、正确率、资源完成数）',
  `estimated_duration` int DEFAULT NULL COMMENT '预估学习时长（分钟）',
  
  -- 节点状态
  `status` tinyint NOT NULL DEFAULT 0 COMMENT '节点状态：0-未开始，1-进行中，2-已完成，3-已跳过，4-已暂缓',
  `is_locked` bit(1) NOT NULL DEFAULT b'1' COMMENT '是否锁定（需完成前置节点才能解锁）',
  
  -- 节点进度
  `progress_percentage` tinyint NOT NULL DEFAULT 0 COMMENT '完成百分比(0-100)',
  `actual_duration` int NOT NULL DEFAULT 0 COMMENT '实际学习时长（分钟）',
  
  -- 时间戳
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `unlock_time` datetime DEFAULT NULL COMMENT '解锁时间',
  `start_time` datetime DEFAULT NULL COMMENT '开始时间',
  `complete_time` datetime DEFAULT NULL COMMENT '完成时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_path_id` (`path_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_node_order` (`path_id`, `node_order`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_node_type` (`node_type`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='路径节点表';


-- ========================================
-- 节点资源关联表
-- ========================================
DROP TABLE IF EXISTS `node_resource`;
CREATE TABLE IF NOT EXISTS `node_resource` (
  `id` bigint NOT NULL COMMENT '关联ID',
  `node_id` bigint NOT NULL COMMENT '节点ID',
  `path_id` bigint NOT NULL COMMENT '路径ID',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  
  -- 资源信息
  `resource_type` varchar(32) NOT NULL COMMENT '资源类型：video-视频，document-文档，exercise-练习，test-测试，article-文章',
  `resource_id` bigint NOT NULL COMMENT '资源ID',
  `resource_name` varchar(256) DEFAULT NULL COMMENT '资源名称',
  `resource_url` varchar(512) DEFAULT NULL COMMENT '资源URL',
  
  -- 资源配置
  `is_required` bit(1) NOT NULL DEFAULT b'1' COMMENT '是否必需完成',
  `resource_order` int NOT NULL DEFAULT 0 COMMENT '资源顺序',
  `estimated_duration` int DEFAULT NULL COMMENT '预估学习时长（分钟）',
  
  -- 推送状态
  `push_status` tinyint NOT NULL DEFAULT 0 COMMENT '推送状态：0-未推送，1-已推送，2-已查看，3-已完成',
  `push_time` datetime DEFAULT NULL COMMENT '推送时间',
  `view_time` datetime DEFAULT NULL COMMENT '查看时间',
  `complete_time` datetime DEFAULT NULL COMMENT '完成时间',
  
  -- 学习进度
  `progress_percentage` tinyint NOT NULL DEFAULT 0 COMMENT '完成百分比(0-100)',
  `actual_duration` int NOT NULL DEFAULT 0 COMMENT '实际学习时长（分钟）',
  
  -- 学习结果
  `score` decimal(5,2) DEFAULT NULL COMMENT '得分（如练习、测试的分数）',
  `pass_status` tinyint DEFAULT NULL COMMENT '通过状态：0-未通过，1-已通过',
  
  -- 时间戳
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_node_id` (`node_id`) USING BTREE,
  KEY `idx_path_id` (`path_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_resource` (`resource_type`, `resource_id`) USING BTREE,
  KEY `idx_push_status` (`push_status`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='节点资源关联表';


-- ========================================
-- 学习进度表
-- ========================================
DROP TABLE IF EXISTS `learning_progress`;
CREATE TABLE IF NOT EXISTS `learning_progress` (
  `id` bigint NOT NULL COMMENT '进度ID',
  `path_id` bigint NOT NULL COMMENT '路径ID',
  `node_id` bigint NOT NULL COMMENT '节点ID',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  
  -- 进度类型
  `progress_type` tinyint NOT NULL COMMENT '进度类型：1-节点开始，2-资源学习，3-节点完成，4-节点暂缓，5-节点跳过',
  
  -- 进度数据
  `progress_data` json DEFAULT NULL COMMENT '进度详细数据',
  `progress_percentage` tinyint NOT NULL DEFAULT 0 COMMENT '进度百分比(0-100)',
  
  -- 学习时长
  `duration` int DEFAULT NULL COMMENT '本次学习时长（秒）',
  `cumulative_duration` int DEFAULT NULL COMMENT '累计学习时长（秒）',
  
  -- 学习结果
  `result_data` json DEFAULT NULL COMMENT '学习结果数据（如：答题结果、测评分数）',
  
  -- 时间戳
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_path_id` (`path_id`) USING BTREE,
  KEY `idx_node_id` (`node_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_progress_type` (`progress_type`) USING BTREE,
  KEY `idx_create_time` (`create_time`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学习进度记录表';


-- ========================================
-- 路径调整记录表
-- ========================================
DROP TABLE IF EXISTS `path_adjustment`;
CREATE TABLE IF NOT EXISTS `path_adjustment` (
  `id` bigint NOT NULL COMMENT '调整记录ID',
  `path_id` bigint NOT NULL COMMENT '路径ID',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  
  -- 调整类型
  `adjustment_type` tinyint NOT NULL COMMENT '调整类型：1-自动优化，2-手动调整，3-难度调整，4-节点增删',
  `trigger_reason` varchar(512) DEFAULT NULL COMMENT '触发原因',
  
  -- 调整内容
  `adjustment_data` json NOT NULL COMMENT '调整详细数据',
  `affected_nodes` json DEFAULT NULL COMMENT '受影响的节点ID列表',
  
  -- 调整前后对比
  `before_snapshot` json DEFAULT NULL COMMENT '调整前快照',
  `after_snapshot` json DEFAULT NULL COMMENT '调整后快照',
  
  -- 调整状态
  `status` tinyint NOT NULL DEFAULT 0 COMMENT '调整状态：0-待确认，1-已应用，2-已拒绝',
  `apply_time` datetime DEFAULT NULL COMMENT '应用时间',
  
  -- 时间戳
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_path_id` (`path_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_adjustment_type` (`adjustment_type`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_create_time` (`create_time`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='路径调整记录表';


-- ========================================
-- 资源推送记录表
-- ========================================
DROP TABLE IF EXISTS `resource_push`;
CREATE TABLE IF NOT EXISTS `resource_push` (
  `id` bigint NOT NULL COMMENT '推送记录ID',
  `path_id` bigint NOT NULL COMMENT '路径ID',
  `node_id` bigint NOT NULL COMMENT '节点ID',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  
  -- 推送内容
  `push_type` tinyint NOT NULL COMMENT '推送类型：1-节点激活推送，2-资源推送，3-提醒推送',
  `push_title` varchar(256) NOT NULL COMMENT '推送标题',
  `push_content` text DEFAULT NULL COMMENT '推送内容',
  `push_data` json DEFAULT NULL COMMENT '推送数据（资源列表、学习指引等）',
  
  -- 推送渠道
  `push_channel` varchar(64) NOT NULL DEFAULT 'system' COMMENT '推送渠道：system-系统消息，email-邮件，sms-短信',
  
  -- 推送状态
  `push_status` tinyint NOT NULL DEFAULT 0 COMMENT '推送状态：0-待推送，1-已推送，2-已读，3-已处理',
  `push_time` datetime DEFAULT NULL COMMENT '推送时间',
  `read_time` datetime DEFAULT NULL COMMENT '阅读时间',
  
  -- 时间戳
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_path_id` (`path_id`) USING BTREE,
  KEY `idx_node_id` (`node_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_push_status` (`push_status`) USING BTREE,
  KEY `idx_push_time` (`push_time`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='资源推送记录表';


-- ========================================
-- 学习日历任务表
-- ========================================
DROP TABLE IF EXISTS `learning_calendar`;
CREATE TABLE IF NOT EXISTS `learning_calendar` (
  `id` bigint NOT NULL COMMENT '任务ID',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `path_id` bigint DEFAULT NULL COMMENT '关联路径ID',
  `node_id` bigint DEFAULT NULL COMMENT '关联节点ID',
  
  -- 任务信息
  `task_title` varchar(256) NOT NULL COMMENT '任务标题',
  `task_desc` text DEFAULT NULL COMMENT '任务描述',
  `task_type` tinyint NOT NULL COMMENT '任务类型：1-路径节点任务，2-测评任务，3-自定义任务',
  
  -- 任务时间
  `plan_date` date NOT NULL COMMENT '计划日期',
  `plan_start_time` time DEFAULT NULL COMMENT '计划开始时间',
  `plan_end_time` time DEFAULT NULL COMMENT '计划结束时间',
  `estimated_duration` int DEFAULT NULL COMMENT '预估时长（分钟）',
  
  -- 任务状态
  `status` tinyint NOT NULL DEFAULT 0 COMMENT '任务状态：0-待开始，1-进行中，2-已完成，3-已逾期，4-已取消',
  `priority` tinyint NOT NULL DEFAULT 2 COMMENT '优先级：1-低，2-中，3-高',
  
  -- 提醒设置
  `reminder_enabled` bit(1) NOT NULL DEFAULT b'0' COMMENT '是否启用提醒',
  `reminder_time` datetime DEFAULT NULL COMMENT '提醒时间',
  `reminder_sent` bit(1) NOT NULL DEFAULT b'0' COMMENT '提醒是否已发送',
  
  -- 完成信息
  `actual_start_time` datetime DEFAULT NULL COMMENT '实际开始时间',
  `actual_end_time` datetime DEFAULT NULL COMMENT '实际结束时间',
  `actual_duration` int DEFAULT NULL COMMENT '实际时长（分钟）',
  
  -- 时间戳
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_path_id` (`path_id`) USING BTREE,
  KEY `idx_node_id` (`node_id`) USING BTREE,
  KEY `idx_plan_date` (`plan_date`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_task_type` (`task_type`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学习日历任务表';


-- ========================================
-- 学习统计表
-- ========================================
DROP TABLE IF EXISTS `learning_statistics`;
CREATE TABLE IF NOT EXISTS `learning_statistics` (
  `id` bigint NOT NULL COMMENT '统计ID',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `stat_date` date NOT NULL COMMENT '统计日期',
  
  -- 学习时长统计
  `total_duration` int NOT NULL DEFAULT 0 COMMENT '总学习时长（分钟）',
  `video_duration` int NOT NULL DEFAULT 0 COMMENT '视频学习时长（分钟）',
  `exercise_duration` int NOT NULL DEFAULT 0 COMMENT '练习时长（分钟）',
  `test_duration` int NOT NULL DEFAULT 0 COMMENT '测试时长（分钟）',
  
  -- 任务完成统计
  `completed_tasks` int NOT NULL DEFAULT 0 COMMENT '完成任务数',
  `completed_nodes` int NOT NULL DEFAULT 0 COMMENT '完成节点数',
  `completed_resources` int NOT NULL DEFAULT 0 COMMENT '完成资源数',
  
  -- 学习效果统计
  `exercise_count` int NOT NULL DEFAULT 0 COMMENT '练习题数',
  `correct_count` int NOT NULL DEFAULT 0 COMMENT '正确题数',
  `accuracy_rate` decimal(5,2) DEFAULT NULL COMMENT '正确率',
  
  -- 知识点统计
  `learned_knowledge_points` json DEFAULT NULL COMMENT '学习的知识点列表',
  `mastered_knowledge_points` json DEFAULT NULL COMMENT '掌握的知识点列表',
  
  -- 时间戳
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_user_date` (`user_id`, `stat_date`) USING BTREE,
  KEY `idx_stat_date` (`stat_date`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学习统计表';


-- ========================================
-- 创建索引优化查询性能
-- ========================================

-- 所有表的索引已在表定义中创建

