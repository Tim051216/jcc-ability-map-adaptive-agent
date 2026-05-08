/*
 Cleaned SQL for local startup.
 Source file: tj_learning.sql
 Note: upstream seed data/comments may contain mojibake, so this version keeps schema-first statements.
*/

CREATE DATABASE IF NOT EXISTS `tj_learning` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `tj_learning`;

/* raw merged source for normalization */



-- source: learning_lesson.sql

-- --------------------------------------------------------
-- 涓绘満:                           192.168.150.101
-- 鏈嶅姟鍣ㄧ増鏈?                        8.0.29 - MySQL Community Server - GPL
-- 鏈嶅姟鍣ㄦ搷浣滅郴缁?                      Linux
-- HeidiSQL 鐗堟湰:                  12.2.0.6576
-- --------------------------------------------------------


-- 瀵煎嚭  琛?tj_learning.learning_lesson 缁撴瀯
DROP TABLE IF EXISTS `learning_lesson`;
CREATE TABLE IF NOT EXISTS `learning_lesson` (
  `id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `course_id` bigint NOT NULL,
  `status` tinyint DEFAULT '0',
  `week_freq` tinyint DEFAULT NULL,
  `plan_status` tinyint NOT NULL DEFAULT '0',
  `learned_sections` int NOT NULL DEFAULT '0',
  `latest_section_id` bigint DEFAULT NULL,
  `latest_learn_time` datetime DEFAULT NULL,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expire_time` datetime DEFAULT NULL,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `idx_user_id` (`user_id`,`course_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- 姝ｅ湪瀵煎嚭琛? tj_learning.learning_lesson 鐨勬暟鎹細~4 rows (澶х害)


-- source: learning_record.sql

-- --------------------------------------------------------
-- 涓绘満:                           192.168.150.101
-- 鏈嶅姟鍣ㄧ増鏈?                        8.0.29 - MySQL Community Server - GPL
-- 鏈嶅姟鍣ㄦ搷浣滅郴缁?                      Linux
-- HeidiSQL 鐗堟湰:                  12.2.0.6576
-- --------------------------------------------------------



-- 瀵煎嚭 tj_learning 鐨勬暟鎹簱缁撴瀯

-- 瀵煎嚭  琛?tj_learning.learning_record 缁撴瀯
CREATE TABLE IF NOT EXISTS `learning_record` (
  `id` bigint NOT NULL,
  `lesson_id` bigint NOT NULL,
  `section_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `moment` int DEFAULT '0',
  `finished` bit(1) NOT NULL DEFAULT b'0',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `finish_time` datetime DEFAULT NULL,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_update_time` (`update_time`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_lesson_id` (`lesson_id`,`section_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- 姝ｅ湪瀵煎嚭琛? tj_learning.learning_record 鐨勬暟鎹細~14 rows (澶х害)


-- source: tj_learning_question.sql

-- --------------------------------------------------------
-- 涓绘満:                           192.168.150.101
-- 鏈嶅姟鍣ㄧ増鏈?                        8.0.29 - MySQL Community Server - GPL
-- 鏈嶅姟鍣ㄦ搷浣滅郴缁?                      Linux
-- HeidiSQL 鐗堟湰:                  12.2.0.6576
-- --------------------------------------------------------



-- 瀵煎嚭 tj_learning 鐨勬暟鎹簱缁撴瀯

-- 瀵煎嚭  琛?tj_learning.interaction_question 缁撴瀯
CREATE TABLE IF NOT EXISTS `interaction_question` (
  `id` bigint NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `description` varchar(2048) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '',
  `course_id` bigint NOT NULL,
  `chapter_id` bigint NOT NULL,
  `section_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `latest_answer_id` bigint DEFAULT NULL,
  `answer_times` int unsigned NOT NULL DEFAULT '0',
  `anonymity` bit(1) NOT NULL DEFAULT b'0',
  `hidden` bit(1) NOT NULL DEFAULT b'0',
  `status` tinyint DEFAULT '0',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_course_id` (`course_id`) USING BTREE,
  KEY `section_id` (`section_id`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- 姝ｅ湪瀵煎嚭琛? tj_learning.interaction_question 鐨勬暟鎹細~3 rows (澶х害)

-- 瀵煎嚭  琛?tj_learning.interaction_reply 缁撴瀯
CREATE TABLE IF NOT EXISTS `interaction_reply` (
  `id` bigint NOT NULL,
  `question_id` bigint NOT NULL,
  `answer_id` bigint DEFAULT '0',
  `user_id` bigint NOT NULL,
  `content` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `target_user_id` bigint DEFAULT '0',
  `target_reply_id` bigint DEFAULT '0',
  `reply_times` int NOT NULL DEFAULT '0',
  `liked_times` int NOT NULL DEFAULT '0',
  `hidden` bit(1) NOT NULL DEFAULT b'0',
  `anonymity` bit(1) NOT NULL DEFAULT b'0',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_question_id` (`question_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- 姝ｅ湪瀵煎嚭琛? tj_learning.interaction_reply 鐨勬暟鎹細~12 rows (澶х害)


-- source: tj_points_board.sql

-- --------------------------------------------------------
-- 涓绘満:                           192.168.150.101
-- 鏈嶅姟鍣ㄧ増鏈?                        8.0.29 - MySQL Community Server - GPL
-- 鏈嶅姟鍣ㄦ搷浣滅郴缁?                      Linux
-- HeidiSQL 鐗堟湰:                  12.2.0.6576
-- --------------------------------------------------------



-- 瀵煎嚭 tj_learning 鐨勬暟鎹簱缁撴瀯

-- 瀵煎嚭  琛?tj_learning.points_board 缁撴瀯
CREATE TABLE IF NOT EXISTS `points_board` (
  `id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `points` int NOT NULL,
  `rank` tinyint NOT NULL,
  `season` smallint NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `idx_season_user` (`season`,`user_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- 姝ｅ湪瀵煎嚭琛? tj_learning.points_board 鐨勬暟鎹細~0 rows (澶х害)

-- 瀵煎嚭  琛?tj_learning.points_board_season 缁撴瀯
CREATE TABLE IF NOT EXISTS `points_board_season` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `begin_time` date NOT NULL,
  `end_time` date NOT NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- 姝ｅ湪瀵煎嚭琛? tj_learning.points_board_season 鐨勬暟鎹細~12 rows (澶х害)

-- 瀵煎嚭  琛?tj_learning.points_record 缁撴瀯
CREATE TABLE IF NOT EXISTS `points_record` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `type` tinyint NOT NULL,
  `points` tinyint NOT NULL,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user_id` (`user_id`,`type`) USING BTREE,
  KEY `idx_create_time` (`create_time`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- 姝ｅ湪瀵煎嚭琛? tj_learning.points_record 鐨勬暟鎹細~0 rows (澶х害)


