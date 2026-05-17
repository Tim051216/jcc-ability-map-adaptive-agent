/*
 多智能体协同资源生成系统 - 数据库设计
 Database: learning
 Description: 学习资源生成、管理和收藏相关表结构
*/

USE `learning`;

-- ========================================
-- 1. 学习资源主表
-- ========================================
DROP TABLE IF EXISTS `learning_resource`;
CREATE TABLE IF NOT EXISTS `learning_resource` (
  `id` BIGINT NOT NULL COMMENT '资源ID',
  `resource_name` VARCHAR(255) NOT NULL COMMENT '资源名称',
  `resource_type` TINYINT NOT NULL COMMENT '资源类型：1-课程讲解文档，2-知识点思维导图，3-分层练习题库，4-教学视频/动画，5-代码实操案例',
  `knowledge_point_id` BIGINT NOT NULL COMMENT '关联知识点ID',
  `course_id` BIGINT NOT NULL COMMENT '关联课程ID',
  `chapter_id` BIGINT DEFAULT NULL COMMENT '关联章节ID',
  `section_id` BIGINT DEFAULT NULL COMMENT '关联小节ID',
  `student_id` BIGINT NOT NULL COMMENT '目标学生ID（个性化生成）',
  `difficulty_level` TINYINT DEFAULT 1 COMMENT '难度等级：1-基础，2-进阶，3-拔高',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '资源状态：1-生成中，2-已完成，3-生成失败',
  `version` INT NOT NULL DEFAULT 1 COMMENT '资源版本号',
  `file_url` VARCHAR(512) DEFAULT NULL COMMENT '资源文件URL（对象存储）',
  `file_size` BIGINT DEFAULT NULL COMMENT '文件大小（字节）',
  `file_format` VARCHAR(32) DEFAULT NULL COMMENT '文件格式：md, json, pdf, mp4等',
  `generation_task_id` BIGINT DEFAULT NULL COMMENT '关联生成任务ID',
  `quality_score` DECIMAL(3,2) DEFAULT NULL COMMENT '质量评分（0-1）',
  `view_count` INT NOT NULL DEFAULT 0 COMMENT '查看次数',
  `download_count` INT NOT NULL DEFAULT 0 COMMENT '下载次数',
  `favorite_count` INT NOT NULL DEFAULT 0 COMMENT '收藏次数',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_student_id` (`student_id`) USING BTREE,
  KEY `idx_course_id` (`course_id`) USING BTREE,
  KEY `idx_knowledge_point` (`knowledge_point_id`) USING BTREE,
  KEY `idx_type_status` (`resource_type`, `status`) USING BTREE,
  KEY `idx_create_time` (`create_time`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学习资源主表';


-- ========================================
-- 2. 资源生成任务表
-- ========================================
DROP TABLE IF EXISTS `resource_generation_task`;
CREATE TABLE IF NOT EXISTS `resource_generation_task` (
  `id` BIGINT NOT NULL COMMENT '任务ID',
  `task_name` VARCHAR(255) NOT NULL COMMENT '任务名称',
  `student_id` BIGINT NOT NULL COMMENT '学生ID',
  `resource_types` VARCHAR(64) NOT NULL COMMENT '资源类型列表（逗号分隔）：1,2,3,4,5',
  `knowledge_point_id` BIGINT NOT NULL COMMENT '知识点ID',
  `course_id` BIGINT NOT NULL COMMENT '课程ID',
  `chapter_id` BIGINT DEFAULT NULL COMMENT '章节ID',
  `section_id` BIGINT DEFAULT NULL COMMENT '小节ID',
  `generation_params` TEXT COMMENT '生成参数（JSON格式）',
  `task_status` TINYINT NOT NULL DEFAULT 1 COMMENT '任务状态：1-待处理，2-处理中，3-已完成，4-部分失败，5-全部失败',
  `progress` TINYINT NOT NULL DEFAULT 0 COMMENT '任务进度（0-100）',
  `total_resources` TINYINT NOT NULL DEFAULT 0 COMMENT '计划生成资源数',
  `completed_resources` TINYINT NOT NULL DEFAULT 0 COMMENT '已完成资源数',
  `failed_resources` TINYINT NOT NULL DEFAULT 0 COMMENT '失败资源数',
  `error_message` TEXT COMMENT '错误信息',
  `start_time` DATETIME DEFAULT NULL COMMENT '开始时间',
  `end_time` DATETIME DEFAULT NULL COMMENT '结束时间',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_student_id` (`student_id`) USING BTREE,
  KEY `idx_task_status` (`task_status`) USING BTREE,
  KEY `idx_create_time` (`create_time`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='资源生成任务表';


-- ========================================
-- 3. 资源内容表（分类型存储）
-- ========================================
DROP TABLE IF EXISTS `resource_content`;
CREATE TABLE IF NOT EXISTS `resource_content` (
  `id` BIGINT NOT NULL COMMENT '内容ID',
  `resource_id` BIGINT NOT NULL COMMENT '资源ID',
  `resource_type` TINYINT NOT NULL COMMENT '资源类型',
  `content_data` LONGTEXT COMMENT '资源内容数据（JSON格式）',
  `content_text` LONGTEXT COMMENT '资源文本内容（用于全文检索）',
  `metadata` TEXT COMMENT '元数据（JSON格式）',
  `version` INT NOT NULL DEFAULT 1 COMMENT '内容版本号',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_resource_version` (`resource_id`, `version`) USING BTREE,
  KEY `idx_resource_id` (`resource_id`) USING BTREE,
  FULLTEXT KEY `ft_content_text` (`content_text`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='资源内容表';


-- ========================================
-- 4. 文档资源详情表
-- ========================================
DROP TABLE IF EXISTS `resource_document`;
CREATE TABLE IF NOT EXISTS `resource_document` (
  `id` BIGINT NOT NULL COMMENT '文档ID',
  `resource_id` BIGINT NOT NULL COMMENT '资源ID',
  `title` VARCHAR(255) NOT NULL COMMENT '文档标题',
  `content_markdown` LONGTEXT NOT NULL COMMENT 'Markdown内容',
  `content_html` LONGTEXT COMMENT 'HTML内容（渲染后）',
  `word_count` INT DEFAULT 0 COMMENT '字数统计',
  `has_formula` BIT(1) DEFAULT b'0' COMMENT '是否包含公式',
  `has_image` BIT(1) DEFAULT b'0' COMMENT '是否包含图片',
  `has_code` BIT(1) DEFAULT b'0' COMMENT '是否包含代码块',
  `outline` TEXT COMMENT '文档大纲（JSON格式）',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_resource_id` (`resource_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文档资源详情表';


-- ========================================
-- 5. 思维导图资源详情表
-- ========================================
DROP TABLE IF EXISTS `resource_mindmap`;
CREATE TABLE IF NOT EXISTS `resource_mindmap` (
  `id` BIGINT NOT NULL COMMENT '思维导图ID',
  `resource_id` BIGINT NOT NULL COMMENT '资源ID',
  `title` VARCHAR(255) NOT NULL COMMENT '思维导图标题',
  `mermaid_code` TEXT NOT NULL COMMENT 'Mermaid代码',
  `node_count` INT DEFAULT 0 COMMENT '节点数量',
  `max_depth` TINYINT DEFAULT 0 COMMENT '最大层级深度',
  `layout_type` VARCHAR(32) DEFAULT 'TB' COMMENT '布局类型：TB-上下，LR-左右',
  `style_config` TEXT COMMENT '样式配置（JSON格式）',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_resource_id` (`resource_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='思维导图资源详情表';


-- ========================================
-- 6. 题库资源详情表
-- ========================================
DROP TABLE IF EXISTS `resource_question_bank`;
CREATE TABLE IF NOT EXISTS `resource_question_bank` (
  `id` BIGINT NOT NULL COMMENT '题库ID',
  `resource_id` BIGINT NOT NULL COMMENT '资源ID',
  `title` VARCHAR(255) NOT NULL COMMENT '题库标题',
  `total_questions` INT NOT NULL DEFAULT 0 COMMENT '题目总数',
  `basic_questions` INT NOT NULL DEFAULT 0 COMMENT '基础层题目数',
  `advanced_questions` INT NOT NULL DEFAULT 0 COMMENT '进阶层题目数',
  `expert_questions` INT NOT NULL DEFAULT 0 COMMENT '拔高层题目数',
  `question_types` VARCHAR(128) COMMENT '题型分布（JSON格式）',
  `knowledge_coverage` TEXT COMMENT '知识点覆盖（JSON格式）',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_resource_id` (`resource_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='题库资源详情表';


-- ========================================
-- 7. 题目详情表
-- ========================================
DROP TABLE IF EXISTS `resource_question`;
CREATE TABLE IF NOT EXISTS `resource_question` (
  `id` BIGINT NOT NULL COMMENT '题目ID',
  `question_bank_id` BIGINT NOT NULL COMMENT '题库ID',
  `question_type` TINYINT NOT NULL COMMENT '题型：1-单选，2-多选，3-判断，4-填空，5-简答，6-编程',
  `difficulty_level` TINYINT NOT NULL COMMENT '难度层级：1-基础，2-进阶，3-拔高',
  `question_content` TEXT NOT NULL COMMENT '题目内容',
  `options` TEXT COMMENT '选项（JSON格式，适用于选择题）',
  `correct_answer` TEXT NOT NULL COMMENT '正确答案',
  `answer_analysis` TEXT COMMENT '答案解析',
  `knowledge_points` VARCHAR(512) COMMENT '关联知识点（逗号分隔）',
  `score` DECIMAL(5,2) DEFAULT 0 COMMENT '分值',
  `order_num` INT NOT NULL DEFAULT 0 COMMENT '排序号',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_question_bank` (`question_bank_id`) USING BTREE,
  KEY `idx_difficulty` (`difficulty_level`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='题目详情表';


-- ========================================
-- 8. 视频资源详情表
-- ========================================
DROP TABLE IF EXISTS `resource_video`;
CREATE TABLE IF NOT EXISTS `resource_video` (
  `id` BIGINT NOT NULL COMMENT '视频ID',
  `resource_id` BIGINT NOT NULL COMMENT '资源ID',
  `title` VARCHAR(255) NOT NULL COMMENT '视频标题',
  `video_url` VARCHAR(512) NOT NULL COMMENT '视频URL',
  `cover_url` VARCHAR(512) COMMENT '封面图URL',
  `duration` INT DEFAULT 0 COMMENT '视频时长（秒）',
  `video_format` VARCHAR(32) COMMENT '视频格式：mp4, avi等',
  `resolution` VARCHAR(32) COMMENT '分辨率：1080p, 720p等',
  `file_size` BIGINT DEFAULT 0 COMMENT '文件大小（字节）',
  `source_type` TINYINT NOT NULL COMMENT '来源类型：1-平台自有，2-外部推荐',
  `source_platform` VARCHAR(64) COMMENT '来源平台',
  `source_url` VARCHAR(512) COMMENT '原始URL',
  `tags` VARCHAR(512) COMMENT '标签（逗号分隔）',
  `description` TEXT COMMENT '视频描述',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_resource_id` (`resource_id`) USING BTREE,
  KEY `idx_source_type` (`source_type`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='视频资源详情表';


-- ========================================
-- 9. 代码案例资源详情表
-- ========================================
DROP TABLE IF EXISTS `resource_code_example`;
CREATE TABLE IF NOT EXISTS `resource_code_example` (
  `id` BIGINT NOT NULL COMMENT '代码案例ID',
  `resource_id` BIGINT NOT NULL COMMENT '资源ID',
  `title` VARCHAR(255) NOT NULL COMMENT '案例标题',
  `description` TEXT COMMENT '案例描述',
  `programming_language` VARCHAR(32) NOT NULL COMMENT '编程语言：Java, Python, JavaScript等',
  `code_content` LONGTEXT NOT NULL COMMENT '代码内容',
  `code_structure` TEXT COMMENT '代码结构（JSON格式，多文件）',
  `run_instructions` TEXT COMMENT '运行说明',
  `expected_output` TEXT COMMENT '预期输出',
  `dependencies` TEXT COMMENT '依赖项（JSON格式）',
  `difficulty_level` TINYINT DEFAULT 1 COMMENT '难度等级：1-基础，2-进阶，3-拔高',
  `has_test_cases` BIT(1) DEFAULT b'0' COMMENT '是否包含测试用例',
  `is_runnable` BIT(1) DEFAULT b'1' COMMENT '是否可直接运行',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_resource_id` (`resource_id`) USING BTREE,
  KEY `idx_language` (`programming_language`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='代码案例资源详情表';


-- ========================================
-- 10. 资源收藏表
-- ========================================
DROP TABLE IF EXISTS `resource_favorite`;
CREATE TABLE IF NOT EXISTS `resource_favorite` (
  `id` BIGINT NOT NULL COMMENT '收藏ID',
  `user_id` BIGINT NOT NULL COMMENT '用户ID',
  `resource_id` BIGINT NOT NULL COMMENT '资源ID',
  `category` VARCHAR(64) DEFAULT '默认分类' COMMENT '收藏分类',
  `notes` VARCHAR(512) COMMENT '收藏备注',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_user_resource` (`user_id`, `resource_id`) USING BTREE,
  KEY `idx_user_category` (`user_id`, `category`) USING BTREE,
  KEY `idx_resource_id` (`resource_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='资源收藏表';


-- ========================================
-- 11. 资源评价表
-- ========================================
DROP TABLE IF EXISTS `resource_evaluation`;
CREATE TABLE IF NOT EXISTS `resource_evaluation` (
  `id` BIGINT NOT NULL COMMENT '评价ID',
  `resource_id` BIGINT NOT NULL COMMENT '资源ID',
  `user_id` BIGINT NOT NULL COMMENT '用户ID',
  `rating` TINYINT NOT NULL COMMENT '评分：1-5星',
  `usefulness_score` TINYINT COMMENT '有用性评分：1-5',
  `accuracy_score` TINYINT COMMENT '准确性评分：1-5',
  `clarity_score` TINYINT COMMENT '清晰度评分：1-5',
  `comment` VARCHAR(512) COMMENT '评价内容',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '评价时间',
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_resource_user` (`resource_id`, `user_id`) USING BTREE,
  KEY `idx_resource_rating` (`resource_id`, `rating`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='资源评价表';


-- ========================================
-- 12. 资源使用统计表
-- ========================================
DROP TABLE IF EXISTS `resource_usage_stats`;
CREATE TABLE IF NOT EXISTS `resource_usage_stats` (
  `id` BIGINT NOT NULL COMMENT '统计ID',
  `resource_id` BIGINT NOT NULL COMMENT '资源ID',
  `user_id` BIGINT NOT NULL COMMENT '用户ID',
  `action_type` TINYINT NOT NULL COMMENT '操作类型：1-查看，2-下载，3-收藏，4-分享',
  `action_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  `duration` INT DEFAULT 0 COMMENT '使用时长（秒，适用于查看）',
  `device_type` VARCHAR(32) COMMENT '设备类型：PC, Mobile等',
  `ip_address` VARCHAR(64) COMMENT 'IP地址',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_resource_id` (`resource_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_action_time` (`action_time`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='资源使用统计表';


-- ========================================
-- 索引优化说明
-- ========================================
-- 1. 主键索引：所有表使用 BIGINT 主键，支持雪花算法ID
-- 2. 唯一索引：防止重复数据（如用户收藏同一资源）
-- 3. 普通索引：优化常用查询条件（用户ID、课程ID、状态等）
-- 4. 组合索引：优化多条件查询（类型+状态、用户+分类等）
-- 5. 全文索引：支持资源内容全文检索

-- ========================================
-- 数据库设计说明
-- ========================================
-- 1. 资源类型：5类资源（文档、导图、题库、视频、代码）
-- 2. 版本管理：支持资源内容版本控制
-- 3. 任务队列：异步生成任务管理
-- 4. 多模态存储：支持文本、JSON、文件URL等多种存储方式
-- 5. 统计分析：记录资源使用情况，支持数据分析
-- 6. 质量控制：资源评分、用户评价等质量指标
