CREATE DATABASE IF NOT EXISTS `tj_learning` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `tj_learning`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `evaluation_test`;
CREATE TABLE `evaluation_test` (
  `id` bigint NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` varchar(1024) DEFAULT NULL,
  `test_type` tinyint NOT NULL,
  `difficulty_level` tinyint NOT NULL,
  `course_id` bigint NOT NULL,
  `chapter_id` bigint DEFAULT NULL,
  `section_id` bigint DEFAULT NULL,
  `knowledge_points` json DEFAULT NULL,
  `total_score` int NOT NULL DEFAULT 100,
  `pass_score` int NOT NULL DEFAULT 60,
  `time_limit` int DEFAULT NULL,
  `question_count` int NOT NULL DEFAULT 0,
  `status` tinyint NOT NULL DEFAULT 1,
  `creator_id` bigint NOT NULL,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_course_id` (`course_id`) USING BTREE,
  KEY `idx_chapter_id` (`chapter_id`) USING BTREE,
  KEY `idx_creator_id` (`creator_id`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `evaluation_question`;
CREATE TABLE `evaluation_question` (
  `id` bigint NOT NULL,
  `test_id` bigint NOT NULL,
  `question_type` tinyint NOT NULL,
  `difficulty_level` tinyint NOT NULL,
  `knowledge_point` varchar(255) NOT NULL,
  `question_content` text NOT NULL,
  `question_options` json DEFAULT NULL,
  `correct_answer` text NOT NULL,
  `answer_analysis` text DEFAULT NULL,
  `score` decimal(5,2) NOT NULL,
  `order_num` int NOT NULL DEFAULT 0,
  `generation_prompt` text DEFAULT NULL,
  `generation_model` varchar(100) DEFAULT NULL,
  `quality_score` decimal(3,2) DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT 1,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_test_id` (`test_id`) USING BTREE,
  KEY `idx_knowledge_point` (`knowledge_point`) USING BTREE,
  KEY `idx_difficulty` (`difficulty_level`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `evaluation_answer_record`;
CREATE TABLE `evaluation_answer_record` (
  `id` bigint NOT NULL,
  `test_id` bigint NOT NULL,
  `question_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `user_answer` text DEFAULT NULL,
  `is_correct` tinyint DEFAULT NULL,
  `score` decimal(5,2) DEFAULT NULL,
  `grading_type` tinyint DEFAULT NULL,
  `grading_feedback` text DEFAULT NULL,
  `grading_model` varchar(100) DEFAULT NULL,
  `answer_time` int DEFAULT NULL,
  `submit_time` datetime DEFAULT NULL,
  `grading_time` datetime DEFAULT NULL,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_test_question_user` (`test_id`, `question_id`, `user_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_test_id` (`test_id`) USING BTREE,
  KEY `idx_submit_time` (`submit_time`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `evaluation_test_record`;
CREATE TABLE `evaluation_test_record` (
  `id` bigint NOT NULL,
  `test_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `total_score` decimal(5,2) DEFAULT NULL,
  `total_questions` int NOT NULL,
  `correct_count` int DEFAULT 0,
  `wrong_count` int DEFAULT 0,
  `unanswered_count` int DEFAULT 0,
  `completion_rate` decimal(5,2) DEFAULT NULL,
  `accuracy_rate` decimal(5,2) DEFAULT NULL,
  `time_spent` int DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT 0,
  `start_time` datetime DEFAULT NULL,
  `submit_time` datetime DEFAULT NULL,
  `grading_complete_time` datetime DEFAULT NULL,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_test_user` (`test_id`, `user_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_submit_time` (`submit_time`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `evaluation_report`;
CREATE TABLE `evaluation_report` (
  `id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `course_id` bigint NOT NULL,
  `report_type` tinyint NOT NULL,
  `time_range_start` datetime DEFAULT NULL,
  `time_range_end` datetime DEFAULT NULL,
  `test_ids` json DEFAULT NULL,
  `overall_score` decimal(5,2) DEFAULT NULL,
  `knowledge_mastery` json DEFAULT NULL,
  `ability_analysis` json DEFAULT NULL,
  `learning_efficiency` json DEFAULT NULL,
  `strengths` text DEFAULT NULL,
  `weaknesses` text DEFAULT NULL,
  `improvement_suggestions` text DEFAULT NULL,
  `recommended_resources` json DEFAULT NULL,
  `generation_model` varchar(100) DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT 1,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_course_id` (`course_id`) USING BTREE,
  KEY `idx_report_type` (`report_type`) USING BTREE,
  KEY `idx_create_time` (`create_time`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `evaluation_knowledge_mastery`;
CREATE TABLE `evaluation_knowledge_mastery` (
  `id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `course_id` bigint NOT NULL,
  `knowledge_point` varchar(255) NOT NULL,
  `mastery_level` tinyint NOT NULL DEFAULT 0,
  `mastery_score` decimal(5,2) DEFAULT NULL,
  `practice_count` int NOT NULL DEFAULT 0,
  `correct_count` int NOT NULL DEFAULT 0,
  `accuracy_rate` decimal(5,2) DEFAULT NULL,
  `last_practice_time` datetime DEFAULT NULL,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_user_course_kp` (`user_id`, `course_id`, `knowledge_point`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_course_id` (`course_id`) USING BTREE,
  KEY `idx_mastery_level` (`mastery_level`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `evaluation_wrong_question`;
CREATE TABLE `evaluation_wrong_question` (
  `id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `question_id` bigint NOT NULL,
  `test_id` bigint NOT NULL,
  `answer_record_id` bigint NOT NULL,
  `knowledge_point` varchar(255) NOT NULL,
  `wrong_count` int NOT NULL DEFAULT 1,
  `is_mastered` tinyint NOT NULL DEFAULT 0,
  `last_wrong_time` datetime NOT NULL,
  `mastered_time` datetime DEFAULT NULL,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_user_question` (`user_id`, `question_id`, `test_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_knowledge_point` (`knowledge_point`) USING BTREE,
  KEY `idx_is_mastered` (`is_mastered`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `evaluation_feedback_loop`;
CREATE TABLE `evaluation_feedback_loop` (
  `id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `report_id` bigint NOT NULL,
  `feedback_type` tinyint NOT NULL,
  `feedback_content` json NOT NULL,
  `action_taken` tinyint NOT NULL DEFAULT 0,
  `action_time` datetime DEFAULT NULL,
  `action_result` text DEFAULT NULL,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_report_id` (`report_id`) USING BTREE,
  KEY `idx_action_taken` (`action_taken`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
