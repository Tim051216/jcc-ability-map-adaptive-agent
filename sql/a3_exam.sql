/*
 Cleaned SQL for local startup.
 Source file: a3_exam.sql
 Note: upstream seed data/comments may contain mojibake, so this version keeps schema-first statements.
*/

CREATE DATABASE IF NOT EXISTS `a3_exam` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `a3_exam`;

/*
 Navicat Premium Dump SQL

 Source Server         : 192.168.150.101_3306
 Source Server Type    : MySQL
 Source Server Version : 80029 (8.0.29)
 Source Host           : 192.168.150.101:3306
 Source Schema         : tj_exam

 Target Server Type    : MySQL
 Target Server Version : 80029 (8.0.29)
 File Encoding         : 65001

 Date: 01/07/2024 23:18:50
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for question
-- ----------------------------
DROP TABLE IF EXISTS `question`;
CREATE TABLE `question`  (
  `id` bigint NOT NULL,
  `name` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `type` tinyint NOT NULL,
  `cate_id1` bigint NOT NULL,
  `cate_id2` bigint NOT NULL,
  `cate_id3` bigint NOT NULL,
  `difficulty` tinyint NOT NULL,
  `answer_times` int NOT NULL DEFAULT 0,
  `correct_times` int NOT NULL DEFAULT 0,
  `score` int NOT NULL,
  `dep_id` bigint NULL DEFAULT NULL,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `creater` bigint NOT NULL DEFAULT 1,
  `updater` bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- ----------------------------
-- Records of question
-- ----------------------------

-- ----------------------------
-- Table structure for question_biz
-- ----------------------------
DROP TABLE IF EXISTS `question_biz`;
CREATE TABLE `question_biz`  (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `biz_id` bigint NULL DEFAULT NULL,
  `question_id` bigint NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `biz_id`(`biz_id` ASC, `question_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 147 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- ----------------------------
-- Records of question_biz
-- ----------------------------

-- ----------------------------
-- Table structure for question_detail
-- ----------------------------
DROP TABLE IF EXISTS `question_detail`;
CREATE TABLE `question_detail`  (
  `id` bigint NOT NULL,
  `options` json NULL,
  `answer` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `analysis` varchar(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- ----------------------------
-- Records of question_detail
-- ----------------------------

-- ----------------------------
-- Table structure for undo_log
-- ----------------------------
DROP TABLE IF EXISTS `undo_log`;
CREATE TABLE `undo_log`  (
  `branch_id` bigint NOT NULL,
  `xid` varchar(100) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `context` varchar(128) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `rollback_info` longblob NOT NULL,
  `log_status` int NOT NULL,
  `log_created` datetime(6) NOT NULL,
  `log_modified` datetime(6) NOT NULL,
  UNIQUE INDEX `ux_undo_log`(`xid` ASC, `branch_id` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8 COLLATE = utf8_general_ci;

-- ----------------------------
-- Records of undo_log
-- ----------------------------

SET FOREIGN_KEY_CHECKS = 1;

