/*
 A3 学习效果评估系统数据库
 用于支持分层练习测评、自动批改、多维度效果评估和个性化学习报告生成
 
 Date: 2026-05-09
*/

CREATE DATABASE IF NOT EXISTS `learning` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `learning`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- 表结构: evaluation_test
-- 测评表 - 存储测评基本信息
-- ----------------------------
DROP TABLE IF EXISTS `evaluation_test`;
CREATE TABLE `evaluation_test` (
  `id` bigint NOT NULL COMMENT '测评ID',
  `title` varchar(255) NOT NULL COMMENT '测评标题',
  `description` varchar(1024) DEFAULT NULL COMMENT '测评描述',
  `test_type` tinyint NOT NULL COMMENT '测评类型: 1-课前测评, 2-课中练习, 3-课后测评, 4-阶段测试',
  `difficulty_level` tinyint NOT NULL COMMENT '难度层级: 1-基础, 2-进阶, 3-拔高',
  `course_id` bigint NOT NULL COMMENT '关联课程ID',
  `chapter_id` bigint DEFAULT NULL COMMENT '关联章节ID',
  `section_id` bigint DEFAULT NULL COMMENT '关联小节ID',
  `knowledge_points` json DEFAULT NULL COMMENT '关联知识点列表',
  `total_score` int NOT NULL DEFAULT 100 COMMENT '总分',
  `pass_score` int NOT NULL DEFAULT 60 COMMENT '及格分',
  `time_limit` int DEFAULT NULL COMMENT '时间限制(分钟), NULL表示不限时',
  `question_count` int NOT NULL DEFAULT 0 COMMENT '题目数量',
  `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态: 0-草稿, 1-已发布, 2-已关闭',
  `creator_id` bigint NOT NULL COMMENT '创建者ID',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_course_id` (`course_id`) USING BTREE,
  KEY `idx_chapter_id` (`chapter_id`) USING BTREE,
  KEY `idx_creator_id` (`creator_id`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='测评表';

-- ----------------------------
-- 表结构: evaluation_question
-- 测评题目表 - 存储AI生成的测评题目
-- ----------------------------
DROP TABLE IF EXISTS `evaluation_question`;
CREATE TABLE `evaluation_question` (
  `id` bigint NOT NULL COMMENT '题目ID',
  `test_id` bigint NOT NULL COMMENT '所属测评ID',
  `question_type` tinyint NOT NULL COMMENT '题目类型: 1-单选, 2-多选, 3-判断, 4-填空, 5-简答, 6-编程',
  `difficulty_level` tinyint NOT NULL COMMENT '难度层级: 1-基础, 2-进阶, 3-拔高',
  `knowledge_point` varchar(255) NOT NULL COMMENT '关联知识点',
  `question_content` text NOT NULL COMMENT '题目内容',
  `question_options` json DEFAULT NULL COMMENT '选项内容(JSON格式), 适用于选择题和判断题',
  `correct_answer` text NOT NULL COMMENT '正确答案',
  `answer_analysis` text DEFAULT NULL COMMENT '答案解析',
  `score` decimal(5,2) NOT NULL COMMENT '题目分值',
  `order_num` int NOT NULL DEFAULT 0 COMMENT '题目顺序',
  `generation_prompt` text DEFAULT NULL COMMENT 'AI生成时使用的提示词',
  `generation_model` varchar(100) DEFAULT NULL COMMENT '生成模型标识',
  `quality_score` decimal(3,2) DEFAULT NULL COMMENT '题目质量评分(0-1)',
  `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态: 0-草稿, 1-已发布, 2-已废弃',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_test_id` (`test_id`) USING BTREE,
  KEY `idx_knowledge_point` (`knowledge_point`) USING BTREE,
  KEY `idx_difficulty` (`difficulty_level`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='测评题目表';

-- ----------------------------
-- 表结构: evaluation_answer_record
-- 答题记录表 - 存储学生答题详情
-- ----------------------------
DROP TABLE IF EXISTS `evaluation_answer_record`;
CREATE TABLE `evaluation_answer_record` (
  `id` bigint NOT NULL COMMENT '答题记录ID',
  `test_id` bigint NOT NULL COMMENT '测评ID',
  `question_id` bigint NOT NULL COMMENT '题目ID',
  `user_id` bigint NOT NULL COMMENT '学生ID',
  `user_answer` text DEFAULT NULL COMMENT '学生答案',
  `is_correct` tinyint DEFAULT NULL COMMENT '是否正确: 0-错误, 1-正确, NULL-待批改',
  `score` decimal(5,2) DEFAULT NULL COMMENT '得分',
  `grading_type` tinyint DEFAULT NULL COMMENT '批改类型: 1-自动批改, 2-AI批改, 3-人工批改',
  `grading_feedback` text DEFAULT NULL COMMENT '批改反馈',
  `grading_model` varchar(100) DEFAULT NULL COMMENT '批改模型标识(AI批改时)',
  `answer_time` int DEFAULT NULL COMMENT '答题用时(秒)',
  `submit_time` datetime DEFAULT NULL COMMENT '提交时间',
  `grading_time` datetime DEFAULT NULL COMMENT '批改时间',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_test_question_user` (`test_id`, `question_id`, `user_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_test_id` (`test_id`) USING BTREE,
  KEY `idx_submit_time` (`submit_time`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='答题记录表';

-- ----------------------------
-- 表结构: evaluation_test_record
-- 测评记录表 - 存储学生整体测评记录
-- ----------------------------
DROP TABLE IF EXISTS `evaluation_test_record`;
CREATE TABLE `evaluation_test_record` (
  `id` bigint NOT NULL COMMENT '测评记录ID',
  `test_id` bigint NOT NULL COMMENT '测评ID',
  `user_id` bigint NOT NULL COMMENT '学生ID',
  `total_score` decimal(5,2) DEFAULT NULL COMMENT '总得分',
  `total_questions` int NOT NULL COMMENT '总题数',
  `correct_count` int DEFAULT 0 COMMENT '正确题数',
  `wrong_count` int DEFAULT 0 COMMENT '错误题数',
  `unanswered_count` int DEFAULT 0 COMMENT '未答题数',
  `completion_rate` decimal(5,2) DEFAULT NULL COMMENT '完成率(%)',
  `accuracy_rate` decimal(5,2) DEFAULT NULL COMMENT '正确率(%)',
  `time_spent` int DEFAULT NULL COMMENT '总用时(秒)',
  `status` tinyint NOT NULL DEFAULT 0 COMMENT '状态: 0-进行中, 1-已提交, 2-已批改',
  `start_time` datetime DEFAULT NULL COMMENT '开始时间',
  `submit_time` datetime DEFAULT NULL COMMENT '提交时间',
  `grading_complete_time` datetime DEFAULT NULL COMMENT '批改完成时间',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_test_user` (`test_id`, `user_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_submit_time` (`submit_time`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='测评记录表';

-- ----------------------------
-- 表结构: evaluation_report
-- 评估报告表 - 存储多维度学习效果评估报告
-- ----------------------------
DROP TABLE IF EXISTS `evaluation_report`;
CREATE TABLE `evaluation_report` (
  `id` bigint NOT NULL COMMENT '报告ID',
  `user_id` bigint NOT NULL COMMENT '学生ID',
  `course_id` bigint NOT NULL COMMENT '课程ID',
  `report_type` tinyint NOT NULL COMMENT '报告类型: 1-单次测评报告, 2-阶段性报告, 3-综合报告',
  `time_range_start` datetime DEFAULT NULL COMMENT '统计时间范围-开始',
  `time_range_end` datetime DEFAULT NULL COMMENT '统计时间范围-结束',
  `test_ids` json DEFAULT NULL COMMENT '关联的测评ID列表',
  `overall_score` decimal(5,2) DEFAULT NULL COMMENT '综合得分',
  `knowledge_mastery` json DEFAULT NULL COMMENT '知识点掌握度分析(JSON格式)',
  `ability_analysis` json DEFAULT NULL COMMENT '能力维度分析(JSON格式)',
  `learning_efficiency` json DEFAULT NULL COMMENT '学习效率分析(JSON格式)',
  `strengths` text DEFAULT NULL COMMENT '优势分析',
  `weaknesses` text DEFAULT NULL COMMENT '薄弱点分析',
  `improvement_suggestions` text DEFAULT NULL COMMENT '改进建议',
  `recommended_resources` json DEFAULT NULL COMMENT '推荐学习资源',
  `generation_model` varchar(100) DEFAULT NULL COMMENT '报告生成模型标识',
  `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态: 0-生成中, 1-已完成',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_course_id` (`course_id`) USING BTREE,
  KEY `idx_report_type` (`report_type`) USING BTREE,
  KEY `idx_create_time` (`create_time`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评估报告表';

-- ----------------------------
-- 表结构: evaluation_knowledge_mastery
-- 知识点掌握度表 - 记录学生对各知识点的掌握情况
-- ----------------------------
DROP TABLE IF EXISTS `evaluation_knowledge_mastery`;
CREATE TABLE `evaluation_knowledge_mastery` (
  `id` bigint NOT NULL COMMENT '记录ID',
  `user_id` bigint NOT NULL COMMENT '学生ID',
  `course_id` bigint NOT NULL COMMENT '课程ID',
  `knowledge_point` varchar(255) NOT NULL COMMENT '知识点',
  `mastery_level` tinyint NOT NULL DEFAULT 0 COMMENT '掌握程度: 0-未学习, 1-初步了解, 2-基本掌握, 3-熟练掌握, 4-精通',
  `mastery_score` decimal(5,2) DEFAULT NULL COMMENT '掌握度分数(0-100)',
  `practice_count` int NOT NULL DEFAULT 0 COMMENT '练习次数',
  `correct_count` int NOT NULL DEFAULT 0 COMMENT '正确次数',
  `accuracy_rate` decimal(5,2) DEFAULT NULL COMMENT '正确率(%)',
  `last_practice_time` datetime DEFAULT NULL COMMENT '最后练习时间',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_user_course_kp` (`user_id`, `course_id`, `knowledge_point`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_course_id` (`course_id`) USING BTREE,
  KEY `idx_mastery_level` (`mastery_level`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='知识点掌握度表';

-- ----------------------------
-- 表结构: evaluation_wrong_question
-- 错题本表 - 记录学生的错题
-- ----------------------------
DROP TABLE IF EXISTS `evaluation_wrong_question`;
CREATE TABLE `evaluation_wrong_question` (
  `id` bigint NOT NULL COMMENT '记录ID',
  `user_id` bigint NOT NULL COMMENT '学生ID',
  `question_id` bigint NOT NULL COMMENT '题目ID',
  `test_id` bigint NOT NULL COMMENT '测评ID',
  `answer_record_id` bigint NOT NULL COMMENT '答题记录ID',
  `knowledge_point` varchar(255) NOT NULL COMMENT '知识点',
  `wrong_count` int NOT NULL DEFAULT 1 COMMENT '错误次数',
  `is_mastered` tinyint NOT NULL DEFAULT 0 COMMENT '是否已掌握: 0-未掌握, 1-已掌握',
  `last_wrong_time` datetime NOT NULL COMMENT '最后错误时间',
  `mastered_time` datetime DEFAULT NULL COMMENT '掌握时间',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_user_question` (`user_id`, `question_id`, `test_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_knowledge_point` (`knowledge_point`) USING BTREE,
  KEY `idx_is_mastered` (`is_mastered`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='错题本表';

-- ----------------------------
-- 表结构: evaluation_feedback_loop
-- 闭环反馈表 - 记录评估结果对学习路径的反馈调整
-- ----------------------------
DROP TABLE IF EXISTS `evaluation_feedback_loop`;
CREATE TABLE `evaluation_feedback_loop` (
  `id` bigint NOT NULL COMMENT '反馈ID',
  `user_id` bigint NOT NULL COMMENT '学生ID',
  `report_id` bigint NOT NULL COMMENT '评估报告ID',
  `feedback_type` tinyint NOT NULL COMMENT '反馈类型: 1-学习路径调整, 2-资源推荐, 3-难度调整, 4-学习提醒',
  `feedback_content` json NOT NULL COMMENT '反馈内容(JSON格式)',
  `action_taken` tinyint NOT NULL DEFAULT 0 COMMENT '是否已执行: 0-未执行, 1-已执行',
  `action_time` datetime DEFAULT NULL COMMENT '执行时间',
  `action_result` text DEFAULT NULL COMMENT '执行结果',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_report_id` (`report_id`) USING BTREE,
  KEY `idx_action_taken` (`action_taken`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='闭环反馈表';

-- ----------------------------
-- 表结构: undo_log (Seata分布式事务)
-- ----------------------------
DROP TABLE IF EXISTS `undo_log`;
CREATE TABLE `undo_log` (
  `branch_id` bigint NOT NULL,
  `xid` varchar(100) NOT NULL,
  `context` varchar(128) NOT NULL,
  `rollback_info` longblob NOT NULL,
  `log_status` int NOT NULL,
  `log_created` datetime(6) NOT NULL,
  `log_modified` datetime(6) NOT NULL,
  UNIQUE KEY `ux_undo_log` (`xid`, `branch_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Seata分布式事务日志表';

SET FOREIGN_KEY_CHECKS = 1;
