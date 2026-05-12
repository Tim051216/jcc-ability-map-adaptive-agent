/*
 学习画像系统数据库设计
 Database: tj_learning
 Description: 对话式学习画像构建相关表结构
*/

USE `tj_learning`;

-- ========================================
-- 学生画像主表
-- ========================================
DROP TABLE IF EXISTS `student_profile`;
CREATE TABLE IF NOT EXISTS `student_profile` (
  `id` bigint NOT NULL COMMENT '画像ID',
  `user_id` bigint NOT NULL COMMENT '学生用户ID',
  `version` int NOT NULL DEFAULT 1 COMMENT '画像版本号',
  
  -- 六维度画像数据（JSON格式存储详细信息）
  `knowledge_base` json DEFAULT NULL COMMENT '知识基础维度：已掌握知识点、薄弱环节、学科背景',
  `cognitive_style` json DEFAULT NULL COMMENT '认知风格维度：学习偏好、思维方式、理解速度',
  `learning_progress` json DEFAULT NULL COMMENT '学习进度维度：当前进度、完成率、学习节奏',
  `error_preference` json DEFAULT NULL COMMENT '易错点偏好维度：常见错误类型、易混淆概念',
  `interest_direction` json DEFAULT NULL COMMENT '兴趣方向维度：感兴趣领域、学习动机、目标方向',
  `learning_habit` json DEFAULT NULL COMMENT '学习习惯维度：学习时间偏好、学习频率、专注时长',
  
  -- 画像标签
  `tags` varchar(1024) DEFAULT NULL COMMENT '学习标签，逗号分隔',
  
  -- 画像完整度
  `completeness` tinyint NOT NULL DEFAULT 0 COMMENT '画像完整度百分比(0-100)',
  
  -- 画像状态
  `status` tinyint NOT NULL DEFAULT 1 COMMENT '画像状态：0-未激活，1-正常，2-已过期',
  
  -- 时间戳
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `last_behavior_time` datetime DEFAULT NULL COMMENT '最后学习行为时间',
  
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_user_id` (`user_id`) USING BTREE,
  KEY `idx_update_time` (`update_time`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学生学习画像主表';


-- ========================================
-- 画像历史版本表
-- ========================================
DROP TABLE IF EXISTS `profile_history`;
CREATE TABLE IF NOT EXISTS `profile_history` (
  `id` bigint NOT NULL COMMENT '历史记录ID',
  `profile_id` bigint NOT NULL COMMENT '画像ID',
  `user_id` bigint NOT NULL COMMENT '学生用户ID',
  `version` int NOT NULL COMMENT '版本号',
  
  -- 快照数据
  `snapshot_data` json NOT NULL COMMENT '画像快照数据（完整六维度）',
  
  -- 变更信息
  `change_type` tinyint NOT NULL COMMENT '变更类型：1-初始创建，2-对话更新，3-行为更新，4-手动调整',
  `change_description` varchar(512) DEFAULT NULL COMMENT '变更描述',
  `changed_dimensions` varchar(256) DEFAULT NULL COMMENT '变更的维度，逗号分隔',
  
  -- 时间戳
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_profile_id` (`profile_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_version` (`version`) USING BTREE,
  KEY `idx_create_time` (`create_time`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='画像历史版本表';


-- ========================================
-- 对话会话表
-- ========================================
DROP TABLE IF EXISTS `conversation_session`;
CREATE TABLE IF NOT EXISTS `conversation_session` (
  `id` bigint NOT NULL COMMENT '会话ID',
  `user_id` bigint NOT NULL COMMENT '学生用户ID',
  `profile_id` bigint DEFAULT NULL COMMENT '关联的画像ID',
  
  -- 会话状态
  `status` tinyint NOT NULL DEFAULT 0 COMMENT '会话状态：0-进行中，1-已完成，2-已中断',
  `session_type` tinyint NOT NULL DEFAULT 1 COMMENT '会话类型：1-初始画像构建，2-画像补充，3-画像验证',
  
  -- 会话进度
  `total_rounds` int NOT NULL DEFAULT 0 COMMENT '总对话轮次',
  `collected_dimensions` varchar(256) DEFAULT NULL COMMENT '已采集的维度，逗号分隔',
  `completeness` tinyint NOT NULL DEFAULT 0 COMMENT '信息采集完整度(0-100)',
  
  -- 时间戳
  `start_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '开始时间',
  `end_time` datetime DEFAULT NULL COMMENT '结束时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_profile_id` (`profile_id`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_start_time` (`start_time`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='对话会话表';


-- ========================================
-- 对话消息表
-- ========================================
DROP TABLE IF EXISTS `conversation_message`;
CREATE TABLE IF NOT EXISTS `conversation_message` (
  `id` bigint NOT NULL COMMENT '消息ID',
  `session_id` bigint NOT NULL COMMENT '会话ID',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  
  -- 消息内容
  `role` varchar(20) NOT NULL COMMENT '角色：user-用户，assistant-助手，system-系统',
  `content` text NOT NULL COMMENT '消息内容',
  `round_number` int NOT NULL COMMENT '对话轮次',
  
  -- 消息元数据
  `message_type` tinyint NOT NULL DEFAULT 1 COMMENT '消息类型：1-普通对话，2-引导问题，3-确认信息',
  `related_dimension` varchar(64) DEFAULT NULL COMMENT '相关维度',
  
  -- 时间戳
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_session_id` (`session_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_round_number` (`round_number`) USING BTREE,
  KEY `idx_create_time` (`create_time`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='对话消息表';


-- ========================================
-- 提取信息表
-- ========================================
DROP TABLE IF EXISTS `extracted_info`;
CREATE TABLE IF NOT EXISTS `extracted_info` (
  `id` bigint NOT NULL COMMENT '信息ID',
  `session_id` bigint NOT NULL COMMENT '会话ID',
  `message_id` bigint NOT NULL COMMENT '消息ID',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  
  -- 提取的信息
  `dimension` varchar(64) NOT NULL COMMENT '所属维度',
  `info_key` varchar(128) NOT NULL COMMENT '信息键',
  `info_value` text NOT NULL COMMENT '信息值',
  `confidence` decimal(3,2) DEFAULT 0.00 COMMENT '置信度(0.00-1.00)',
  
  -- 提取元数据
  `extraction_method` varchar(64) DEFAULT NULL COMMENT '提取方法：llm-大模型提取，rule-规则提取',
  `verified` bit(1) NOT NULL DEFAULT b'0' COMMENT '是否已验证',
  
  -- 时间戳
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_session_id` (`session_id`) USING BTREE,
  KEY `idx_message_id` (`message_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_dimension` (`dimension`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='对话提取信息表';


-- ========================================
-- 学习行为数据表
-- ========================================
DROP TABLE IF EXISTS `learning_behavior`;
CREATE TABLE IF NOT EXISTS `learning_behavior` (
  `id` bigint NOT NULL COMMENT '行为ID',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `profile_id` bigint DEFAULT NULL COMMENT '画像ID',
  
  -- 行为类型
  `behavior_type` tinyint NOT NULL COMMENT '行为类型：1-答题，2-资源浏览，3-路径完成，4-互动问答',
  
  -- 行为数据（JSON格式存储详细信息）
  `behavior_data` json NOT NULL COMMENT '行为详细数据',
  
  -- 关联资源
  `resource_type` varchar(32) DEFAULT NULL COMMENT '资源类型：course-课程，section-小节，question-题目',
  `resource_id` bigint DEFAULT NULL COMMENT '资源ID',
  
  -- 行为结果
  `result` varchar(32) DEFAULT NULL COMMENT '行为结果：correct-正确，wrong-错误，completed-完成，abandoned-放弃',
  `duration` int DEFAULT NULL COMMENT '行为时长（秒）',
  
  -- 时间戳
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_profile_id` (`profile_id`) USING BTREE,
  KEY `idx_behavior_type` (`behavior_type`) USING BTREE,
  KEY `idx_resource` (`resource_type`, `resource_id`) USING BTREE,
  KEY `idx_create_time` (`create_time`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学习行为数据表';


-- ========================================
-- 画像维度定义表（配置表）
-- ========================================
DROP TABLE IF EXISTS `profile_dimension_config`;
CREATE TABLE IF NOT EXISTS `profile_dimension_config` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '配置ID',
  `dimension_code` varchar(64) NOT NULL COMMENT '维度代码',
  `dimension_name` varchar(128) NOT NULL COMMENT '维度名称',
  `dimension_desc` varchar(512) DEFAULT NULL COMMENT '维度描述',
  
  -- 维度配置
  `required_fields` json DEFAULT NULL COMMENT '必需字段配置',
  `optional_fields` json DEFAULT NULL COMMENT '可选字段配置',
  `weight` decimal(3,2) NOT NULL DEFAULT 1.00 COMMENT '维度权重',
  
  -- 采集引导
  `guide_questions` json DEFAULT NULL COMMENT '引导问题列表',
  
  -- 状态
  `enabled` bit(1) NOT NULL DEFAULT b'1' COMMENT '是否启用',
  `sort_order` int NOT NULL DEFAULT 0 COMMENT '排序顺序',
  
  -- 时间戳
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_dimension_code` (`dimension_code`) USING BTREE,
  KEY `idx_enabled` (`enabled`) USING BTREE,
  KEY `idx_sort_order` (`sort_order`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='画像维度定义配置表';


-- ========================================
-- 初始化维度配置数据
-- ========================================
INSERT INTO `profile_dimension_config` 
  (`dimension_code`, `dimension_name`, `dimension_desc`, `weight`, `sort_order`, `guide_questions`) 
VALUES
  ('knowledge_base', '知识基础', '学生已掌握的知识点、薄弱环节和学科背景', 1.00, 1, 
   JSON_ARRAY(
     '你之前学习过哪些相关课程或知识？',
     '在这个领域，你觉得自己哪些方面比较擅长？',
     '有哪些知识点你觉得比较难理解或容易混淆？'
   )),
  ('cognitive_style', '认知风格', '学生的学习偏好、思维方式和理解速度', 1.00, 2,
   JSON_ARRAY(
     '你更喜欢通过什么方式学习？（如：视频、文字、实践操作）',
     '学习新知识时，你倾向于先了解整体框架还是深入细节？',
     '你觉得自己理解新概念的速度如何？'
   )),
  ('learning_progress', '学习进度', '学生当前的学习进度、完成率和学习节奏', 1.00, 3,
   JSON_ARRAY(
     '你目前的学习进度如何？',
     '你希望以什么样的节奏完成学习？',
     '每周你能投入多少时间用于学习？'
   )),
  ('error_preference', '易错点偏好', '学生常见的错误类型和易混淆的概念', 1.00, 4,
   JSON_ARRAY(
     '在之前的学习中，你经常在哪些类型的问题上出错？',
     '有哪些概念你容易混淆？',
     '你觉得自己在学习中最需要注意什么？'
   )),
  ('interest_direction', '兴趣方向', '学生感兴趣的领域、学习动机和目标方向', 1.00, 5,
   JSON_ARRAY(
     '你对哪些领域或主题特别感兴趣？',
     '你学习这门课程的主要目标是什么？',
     '你希望通过学习达到什么样的水平？'
   )),
  ('learning_habit', '学习习惯', '学生的学习时间偏好、学习频率和专注时长', 1.00, 6,
   JSON_ARRAY(
     '你通常在什么时间段学习效率最高？',
     '你一般能持续专注学习多长时间？',
     '你更喜欢集中学习还是分散学习？'
   ));


-- ========================================
-- 创建索引优化查询性能
-- ========================================

-- 学生画像主表索引已在表定义中创建

-- 画像历史版本表索引已在表定义中创建

-- 对话会话表索引已在表定义中创建

-- 对话消息表索引已在表定义中创建

-- 提取信息表索引已在表定义中创建

-- 学习行为数据表索引已在表定义中创建

-- 画像维度配置表索引已在表定义中创建
