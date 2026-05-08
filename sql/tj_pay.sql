/*
 Cleaned SQL for local startup.
 Source file: tj_pay.sql
 Note: upstream seed data/comments may contain mojibake, so this version keeps schema-first statements.
*/

CREATE DATABASE IF NOT EXISTS `tj_pay` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `tj_pay`;

/*
 Navicat Premium Dump SQL

 Source Server         : 192.168.150.101_3306
 Source Server Type    : MySQL
 Source Server Version : 80029 (8.0.29)
 Source Host           : 192.168.150.101:3306
 Source Schema         : tj_pay

 Target Server Type    : MySQL
 Target Server Version : 80029 (8.0.29)
 File Encoding         : 65001

 Date: 01/07/2024 23:19:37
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for pay_channel
-- ----------------------------
DROP TABLE IF EXISTS `pay_channel`;
CREATE TABLE `pay_channel`  (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(50) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `channel_code` varchar(30) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `channel_priority` int NOT NULL,
  `channel_icon` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `status` int NOT NULL DEFAULT 1,
  `creater` bigint NOT NULL,
  `updater` bigint NOT NULL,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 4 CHARACTER SET = utf8 COLLATE = utf8_general_ci;

-- ----------------------------
-- Records of pay_channel
-- ----------------------------

-- ----------------------------
-- Table structure for pay_order
-- ----------------------------
DROP TABLE IF EXISTS `pay_order`;
CREATE TABLE `pay_order`  (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `biz_order_no` bigint NOT NULL,
  `pay_order_no` bigint NOT NULL DEFAULT 0,
  `biz_user_id` bigint NOT NULL,
  `pay_channel_code` varchar(30) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT '0',
  `amount` int NOT NULL,
  `pay_type` tinyint NOT NULL DEFAULT 4,
  `status` tinyint NOT NULL DEFAULT 0,
  `expand_json` varchar(1024) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT '',
  `notify_url` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT '',
  `notify_times` int NOT NULL DEFAULT 0,
  `notify_status` int NOT NULL DEFAULT 0,
  `result_code` varchar(20) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT '',
  `result_msg` varchar(50) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT '',
  `pay_success_time` datetime NULL DEFAULT NULL,
  `pay_over_time` datetime NOT NULL,
  `qr_code_url` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `creater` bigint NOT NULL DEFAULT 0,
  `updater` bigint NOT NULL DEFAULT 0,
  `deleted` bit(1) NOT NULL DEFAULT b'0',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `biz_order_no`(`biz_order_no` ASC) USING BTREE,
  UNIQUE INDEX `pay_order_no`(`pay_order_no` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1585168008500764674 CHARACTER SET = utf8 COLLATE = utf8_general_ci;

-- ----------------------------
-- Records of pay_order
-- ----------------------------

-- ----------------------------
-- Table structure for refund_order
-- ----------------------------
DROP TABLE IF EXISTS `refund_order`;
CREATE TABLE `refund_order`  (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `biz_order_no` bigint NOT NULL,
  `biz_refund_order_no` bigint NOT NULL,
  `pay_order_no` bigint NOT NULL,
  `refund_order_no` bigint NOT NULL,
  `refund_amount` int NOT NULL,
  `total_amount` int NOT NULL,
  `is_split` bit(1) NOT NULL DEFAULT b'0',
  `pay_channel_code` varchar(30) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT '0',
  `result_code` varchar(64) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT '',
  `result_msg` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT '',
  `status` int NOT NULL DEFAULT 0,
  `refund_channel` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL,
  `notify_failed_times` int NOT NULL DEFAULT 0,
  `notify_status` int NOT NULL DEFAULT 0,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `creater` bigint NOT NULL DEFAULT 0,
  `updater` bigint NOT NULL DEFAULT 0,
  `deleted` bit(1) NOT NULL DEFAULT b'0',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `index_biz_order_id`(`biz_refund_order_no` ASC) USING BTREE,
  INDEX `index_create_time`(`create_time` ASC) USING BTREE,
  INDEX `index_refund_order_id`(`refund_order_no` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1588164197026390019 CHARACTER SET = utf8 COLLATE = utf8_general_ci;

-- ----------------------------
-- Records of refund_order
-- ----------------------------

SET FOREIGN_KEY_CHECKS = 1;

