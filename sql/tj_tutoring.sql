/*
 智能辅导系统数据库表设计
 Database: tj_learning
 Description: 智能辅导相关表，支持多模态问题提问、实时解答、答疑历史和人工兜底
*/

USE `tj_learning`;

-- --------------------------------------------------------
-- 表: tutoring_session
-- 描述: 答疑会话表，管理学生的答疑会话
-- --------------------------------------------------------
DROP TABLE IF EXISTS `tutoring_session`;
CREATE TABLE IF NOT EXISTS `tutoring_session` (
  `id` BIGINT NOT NULL COMMENT '会话ID',
  `user_id` BIGINT NOT NULL COMMENT '学生ID',
  `course_id` BIGINT DEFAULT NULL COMMENT '关联课程ID（可选）',
  `section_id` BIGINT DEFAULT NULL COMMENT '关联章节ID（可选）',
  `session_status` TINYINT NOT NULL DEFAULT 0 COMMENT '会话状态：0-进行中，1-已结束，2-已升级',
  `question_count` INT NOT NULL DEFAULT 0 COMMENT '问题数量',
  `start_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '会话开始时间',
  `end_time` DATETIME DEFAULT NULL COMMENT '会话结束时间',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_course_section` (`course_id`, `section_id`) USING BTREE,
  KEY `idx_status` (`session_status`) USING BTREE,
  KEY `idx_create_time` (`create_time`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='答疑会话表';

-- --------------------------------------------------------
-- 表: tutoring_question
-- 描述: 问题表，存储学生提出的问题（支持文字+图片）
-- --------------------------------------------------------
DROP TABLE IF EXISTS `tutoring_question`;
CREATE TABLE IF NOT EXISTS `tutoring_question` (
  `id` BIGINT NOT NULL COMMENT '问题ID',
  `session_id` BIGINT NOT NULL COMMENT '所属会话ID',
  `user_id` BIGINT NOT NULL COMMENT '提问学生ID',
  `course_id` BIGINT DEFAULT NULL COMMENT '关联课程ID',
  `section_id` BIGINT DEFAULT NULL COMMENT '关联章节ID',
  `question_text` TEXT NOT NULL COMMENT '问题文字内容',
  `question_images` JSON DEFAULT NULL COMMENT '问题图片URL列表（JSON数组）',
  `question_type` VARCHAR(50) DEFAULT NULL COMMENT '问题类型（概念理解/解题方法/代码调试等）',
  `knowledge_points` JSON DEFAULT NULL COMMENT '关联知识点列表（JSON数组）',
  `difficulty_level` TINYINT DEFAULT NULL COMMENT '问题难度：1-简单，2-中等，3-困难',
  `question_status` TINYINT NOT NULL DEFAULT 0 COMMENT '问题状态：0-待处理，1-已解答，2-已升级，3-已关闭',
  `has_answer` BIT(1) NOT NULL DEFAULT b'0' COMMENT '是否已有解答',
  `is_escalated` BIT(1) NOT NULL DEFAULT b'0' COMMENT '是否已升级到人工',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_session_id` (`session_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_course_section` (`course_id`, `section_id`) USING BTREE,
  KEY `idx_status` (`question_status`) USING BTREE,
  KEY `idx_create_time` (`create_time`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='问题表';

-- --------------------------------------------------------
-- 表: tutoring_answer
-- 描述: 解答表，存储AI或人工生成的解答（支持文字+图解+视频）
-- --------------------------------------------------------
DROP TABLE IF EXISTS `tutoring_answer`;
CREATE TABLE IF NOT EXISTS `tutoring_answer` (
  `id` BIGINT NOT NULL COMMENT '解答ID',
  `question_id` BIGINT NOT NULL COMMENT '关联问题ID',
  `session_id` BIGINT NOT NULL COMMENT '所属会话ID',
  `answer_source` TINYINT NOT NULL DEFAULT 0 COMMENT '解答来源：0-AI生成，1-人工解答',
  `answerer_id` BIGINT DEFAULT NULL COMMENT '解答者ID（人工解答时有效）',
  `answer_text` TEXT NOT NULL COMMENT '解答文字内容（Markdown格式）',
  `answer_diagrams` JSON DEFAULT NULL COMMENT '图解内容（Mermaid代码，JSON数组）',
  `answer_videos` JSON DEFAULT NULL COMMENT '推荐视频列表（JSON数组，包含视频ID、标题、时间戳等）',
  `reference_sources` JSON DEFAULT NULL COMMENT '参考资料来源（JSON数组）',
  `confidence_score` DECIMAL(5,2) DEFAULT NULL COMMENT '置信度分数（0-100）',
  `generation_time` INT DEFAULT NULL COMMENT '生成耗时（毫秒）',
  `is_helpful` BIT(1) DEFAULT NULL COMMENT '是否有帮助（用户评价）',
  `user_rating` TINYINT DEFAULT NULL COMMENT '用户评分（1-5星）',
  `user_feedback` VARCHAR(500) DEFAULT NULL COMMENT '用户反馈文字',
  `view_count` INT NOT NULL DEFAULT 0 COMMENT '查看次数',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_question_id` (`question_id`) USING BTREE,
  KEY `idx_session_id` (`session_id`) USING BTREE,
  KEY `idx_source` (`answer_source`) USING BTREE,
  KEY `idx_confidence` (`confidence_score`) USING BTREE,
  KEY `idx_create_time` (`create_time`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='解答表';

-- --------------------------------------------------------
-- 表: escalation_record
-- 描述: 升级记录表，记录疑难问题升级到人工处理的流程
-- --------------------------------------------------------
DROP TABLE IF EXISTS `escalation_record`;
CREATE TABLE IF NOT EXISTS `escalation_record` (
  `id` BIGINT NOT NULL COMMENT '升级记录ID',
  `question_id` BIGINT NOT NULL COMMENT '关联问题ID',
  `session_id` BIGINT NOT NULL COMMENT '所属会话ID',
  `user_id` BIGINT NOT NULL COMMENT '学生ID',
  `escalation_reason` TINYINT NOT NULL COMMENT '升级原因：1-置信度低，2-生成超时，3-用户主动请求，4-多次解答不满意',
  `ai_confidence_score` DECIMAL(5,2) DEFAULT NULL COMMENT 'AI解答置信度（触发升级时）',
  `escalation_status` TINYINT NOT NULL DEFAULT 0 COMMENT '处理状态：0-待分配，1-已分配，2-处理中，3-已完成，4-已取消',
  `assigned_expert_id` BIGINT DEFAULT NULL COMMENT '分配的专家ID',
  `assign_time` DATETIME DEFAULT NULL COMMENT '分配时间',
  `expert_answer_id` BIGINT DEFAULT NULL COMMENT '专家解答ID',
  `complete_time` DATETIME DEFAULT NULL COMMENT '完成时间',
  `response_time` INT DEFAULT NULL COMMENT '响应时长（分钟）',
  `expert_notes` VARCHAR(500) DEFAULT NULL COMMENT '专家备注',
  `feedback_to_ai` BIT(1) NOT NULL DEFAULT b'0' COMMENT '是否已反馈给AI系统',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_question_id` (`question_id`) USING BTREE,
  KEY `idx_session_id` (`session_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_status` (`escalation_status`) USING BTREE,
  KEY `idx_expert_id` (`assigned_expert_id`) USING BTREE,
  KEY `idx_create_time` (`create_time`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='升级记录表';

-- --------------------------------------------------------
-- 表: tutoring_favorite
-- 描述: 收藏记录表，学生收藏的答疑记录
-- --------------------------------------------------------
DROP TABLE IF EXISTS `tutoring_favorite`;
CREATE TABLE IF NOT EXISTS `tutoring_favorite` (
  `id` BIGINT NOT NULL COMMENT '收藏ID',
  `user_id` BIGINT NOT NULL COMMENT '学生ID',
  `question_id` BIGINT NOT NULL COMMENT '问题ID',
  `answer_id` BIGINT NOT NULL COMMENT '解答ID',
  `favorite_note` VARCHAR(200) DEFAULT NULL COMMENT '收藏备注',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_user_question` (`user_id`, `question_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_create_time` (`create_time`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='收藏记录表';

-- --------------------------------------------------------
-- 索引说明
-- --------------------------------------------------------
-- tutoring_session: 
--   - idx_user_id: 按用户查询会话
--   - idx_course_section: 按课程章节查询
--   - idx_status: 按状态筛选
--   - idx_create_time: 按时间排序

-- tutoring_question:
--   - idx_session_id: 查询会话下的所有问题
--   - idx_user_id: 查询用户的所有问题
--   - idx_course_section: 按课程章节查询问题
--   - idx_status: 按状态筛选
--   - idx_create_time: 按时间排序

-- tutoring_answer:
--   - idx_question_id: 查询问题的解答
--   - idx_session_id: 查询会话下的所有解答
--   - idx_source: 按解答来源筛选
--   - idx_confidence: 按置信度筛选低质量解答
--   - idx_create_time: 按时间排序

-- escalation_record:
--   - idx_question_id: 查询问题的升级记录
--   - idx_session_id: 查询会话的升级记录
--   - idx_user_id: 查询用户的升级记录
--   - idx_status: 按处理状态筛选
--   - idx_expert_id: 查询专家的待处理任务
--   - idx_create_time: 按时间排序

-- tutoring_favorite:
--   - uk_user_question: 防止重复收藏
--   - idx_user_id: 查询用户的收藏列表
--   - idx_create_time: 按时间排序
