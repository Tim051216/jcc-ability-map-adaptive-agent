-- 智能复习提醒最小闭环初始化脚本
-- learning 库：tj_learning
USE tj_learning;

CREATE TABLE IF NOT EXISTS review_reminder_task (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  course_id BIGINT NULL,
  lesson_id BIGINT NULL,
  resource_id BIGINT NULL,
  trigger_type VARCHAR(32) NOT NULL DEFAULT 'REVIEW_DUE',
  title VARCHAR(128) NOT NULL,
  content VARCHAR(500) NOT NULL,
  source_video VARCHAR(255) NULL,
  remind_at DATETIME NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  channel_strategy VARCHAR(64) NOT NULL DEFAULT 'IN_APP',
  fail_reason VARCHAR(255) NULL,
  extra_json TEXT NULL,
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_review_reminder_user (user_id),
  KEY idx_review_reminder_status_time (status, remind_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- message 库：tj_message
USE tj_message;

CREATE TABLE IF NOT EXISTS user_channel_binding (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  channel_type VARCHAR(32) NOT NULL,
  channel_user_key VARCHAR(128) NOT NULL,
  verified TINYINT NOT NULL DEFAULT 0,
  enabled TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_channel_binding_user (user_id),
  KEY idx_channel_binding_type_key (channel_type, channel_user_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notification_preference (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  allow_review_reminder TINYINT NOT NULL DEFAULT 1,
  quiet_start VARCHAR(8) DEFAULT '22:00',
  quiet_end VARCHAR(8) DEFAULT '08:00',
  preferred_channels VARCHAR(64) DEFAULT 'IN_APP',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_notification_preference_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notification_send_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  task_id BIGINT NULL,
  user_id BIGINT NOT NULL,
  channel_type VARCHAR(32) NOT NULL,
  message_title VARCHAR(128) NULL,
  message_body VARCHAR(500) NULL,
  send_status VARCHAR(32) NOT NULL,
  provider_message_id VARCHAR(128) NULL,
  error_message VARCHAR(500) NULL,
  sent_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notification_send_log_task (task_id),
  KEY idx_notification_send_log_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
