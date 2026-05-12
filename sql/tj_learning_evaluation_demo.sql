USE `tj_learning`;

DELETE FROM `evaluation_feedback_loop` WHERE `report_id` = 920001;
DELETE FROM `evaluation_knowledge_mastery` WHERE `user_id` = 1 AND `course_id` = 1;
DELETE FROM `evaluation_report` WHERE `id` = 920001;
DELETE FROM `evaluation_wrong_question` WHERE `test_id` = 910001 AND `user_id` = 1;
DELETE FROM `evaluation_answer_record` WHERE `test_id` = 910001 AND `user_id` = 1;
DELETE FROM `evaluation_test_record` WHERE `test_id` = 910001 AND `user_id` = 1;
DELETE FROM `evaluation_question` WHERE `test_id` = 910001;
DELETE FROM `evaluation_test` WHERE `id` = 910001;

INSERT INTO `evaluation_test` (
  `id`, `title`, `description`, `test_type`, `difficulty_level`, `course_id`,
  `chapter_id`, `section_id`, `knowledge_points`, `total_score`, `pass_score`,
  `time_limit`, `question_count`, `status`, `creator_id`, `create_time`, `update_time`
) VALUES (
  910001,
  '模型评估与过拟合阶段测评',
  '用于学生端演示的本地测评样例，覆盖知识理解、指标判断与改进建议。',
  4, 2, 1, NULL, NULL,
  JSON_ARRAY('过拟合', '泛化误差', '交叉验证'),
  100, 60, 30, 3, 1, 1, NOW(), NOW()
);

INSERT INTO `evaluation_question` (
  `id`, `test_id`, `question_type`, `difficulty_level`, `knowledge_point`,
  `question_content`, `question_options`, `correct_answer`, `answer_analysis`,
  `score`, `order_num`, `generation_prompt`, `generation_model`, `quality_score`,
  `status`, `create_time`, `update_time`
) VALUES
(
  910101, 910001, 1, 1, '过拟合',
  '下面哪一项最能体现模型发生过拟合？',
  JSON_ARRAY(
    JSON_OBJECT('label', 'A. 训练集准确率高，验证集准确率显著下降', 'value', 'A'),
    JSON_OBJECT('label', 'B. 训练集和验证集准确率都稳定上升', 'value', 'B'),
    JSON_OBJECT('label', 'C. 模型参数更少，推理更快', 'value', 'C'),
    JSON_OBJECT('label', 'D. 学习率变大后损失下降', 'value', 'D')
  ),
  'A',
  '过拟合通常表现为模型在训练集拟合很好，但在验证集或测试集泛化能力变差。',
  30.00, 1, NULL, NULL, 0.95, 1, NOW(), NOW()
),
(
  910102, 910001, 1, 2, '泛化误差',
  '若想更稳定地评估模型泛化能力，下列做法更合适的是哪一项？',
  JSON_ARRAY(
    JSON_OBJECT('label', 'A. 只看训练集损失', 'value', 'A'),
    JSON_OBJECT('label', 'B. 使用交叉验证并观察验证集表现', 'value', 'B'),
    JSON_OBJECT('label', 'C. 将测试集也参与训练', 'value', 'C'),
    JSON_OBJECT('label', 'D. 只增大模型层数', 'value', 'D')
  ),
  'B',
  '交叉验证能够更全面地评估模型在不同数据划分下的稳定性与泛化表现。',
  35.00, 2, NULL, NULL, 0.94, 1, NOW(), NOW()
),
(
  910103, 910001, 5, 2, '交叉验证',
  '请简要说明为什么在模型评估中不能只看训练集准确率。',
  NULL,
  '因为训练集准确率只能说明模型对已见数据的拟合情况，不能反映其对未见数据的泛化能力，需要结合验证集或测试集指标综合判断。',
  '训练集表现好不等于模型泛化好，必须结合验证集、测试集或交叉验证来判断是否过拟合。',
  35.00, 3, NULL, NULL, 0.90, 1, NOW(), NOW()
);

INSERT INTO `evaluation_answer_record` (
  `id`, `test_id`, `question_id`, `user_id`, `user_answer`, `is_correct`, `score`,
  `grading_type`, `grading_feedback`, `grading_model`, `answer_time`, `submit_time`,
  `grading_time`, `create_time`, `update_time`
) VALUES
(
  910201, 910001, 910101, 1, 'A', 1, 30.00, 1,
  '判断正确，已经能够识别训练集与验证集表现分离这一典型过拟合特征。',
  NULL, 45, NOW(), NOW(), NOW(), NOW()
),
(
  910202, 910001, 910102, 1, 'D', 0, 0.00, 1,
  '本题错误。只增大模型层数不能稳定评估泛化能力，正确思路应是使用交叉验证并观察验证集表现。',
  NULL, 52, NOW(), NOW(), NOW(), NOW()
),
(
  910203, 910001, 910103, 1,
  '训练准确率高说明模型学得不错，所以基本可以判断效果很好。',
  0, 12.00, 2,
  '回答只强调了训练集表现，忽略了验证集或测试集在衡量泛化能力中的作用，需要补充对过拟合风险的说明。',
  'demo-evaluator', 90, NOW(), NOW(), NOW(), NOW()
);

INSERT INTO `evaluation_test_record` (
  `id`, `test_id`, `user_id`, `total_score`, `total_questions`, `correct_count`,
  `wrong_count`, `unanswered_count`, `completion_rate`, `accuracy_rate`, `time_spent`,
  `status`, `start_time`, `submit_time`, `grading_complete_time`, `create_time`, `update_time`
) VALUES (
  910301, 910001, 1, 42.00, 3, 1, 2, 0, 100.00, 33.33, 187, 2,
  NOW(), NOW(), NOW(), NOW(), NOW()
);

INSERT INTO `evaluation_wrong_question` (
  `id`, `user_id`, `question_id`, `test_id`, `answer_record_id`, `knowledge_point`,
  `wrong_count`, `is_mastered`, `last_wrong_time`, `mastered_time`, `create_time`, `update_time`
) VALUES
(
  910401, 1, 910102, 910001, 910202, '泛化误差', 1, 0, NOW(), NULL, NOW(), NOW()
),
(
  910402, 1, 910103, 910001, 910203, '交叉验证', 1, 0, NOW(), NULL, NOW(), NOW()
);

INSERT INTO `evaluation_report` (
  `id`, `user_id`, `course_id`, `report_type`, `time_range_start`, `time_range_end`,
  `test_ids`, `overall_score`, `knowledge_mastery`, `ability_analysis`, `learning_efficiency`,
  `strengths`, `weaknesses`, `improvement_suggestions`, `recommended_resources`,
  `generation_model`, `status`, `create_time`, `update_time`
) VALUES (
  920001, 1, 1, 1, NOW(), NOW(),
  JSON_ARRAY(910001),
  42.00,
  JSON_OBJECT(
    'knowledge_points', JSON_ARRAY(
      JSON_OBJECT('knowledge_point', '过拟合', 'accuracy_rate', 100, 'mastery_level', 3, 'total_questions', 1, 'correct_count', 1),
      JSON_OBJECT('knowledge_point', '泛化误差', 'accuracy_rate', 0, 'mastery_level', 1, 'total_questions', 1, 'correct_count', 0),
      JSON_OBJECT('knowledge_point', '交叉验证', 'accuracy_rate', 34, 'mastery_level', 1, 'total_questions', 1, 'correct_count', 0)
    )
  ),
  JSON_OBJECT(
    'dimensions', JSON_ARRAY(
      JSON_OBJECT('level_name', '基础理解', 'accuracy_rate', 100),
      JSON_OBJECT('level_name', '指标判断', 'accuracy_rate', 0),
      JSON_OBJECT('level_name', '综合表达', 'accuracy_rate', 34)
    )
  ),
  JSON_OBJECT(
    'overall_efficiency', 58,
    'time_efficiency', 64,
    'accuracy_rate', 33.33,
    'efficiency_level', '需加强',
    'time_spent_minutes', 3
  ),
  '能够准确识别训练集与验证集表现分离这一过拟合特征。',
  '对泛化能力评估方法理解不足；主观题回答没有体现验证集、测试集或交叉验证在判断模型泛化中的作用。',
  '先复习交叉验证与泛化误差，再完成一轮针对性错题巩固；答辩时重点补充“为什么不能只看训练集准确率”。',
  JSON_ARRAY(
    JSON_OBJECT('title', '模型评估专题讲义', 'type', 'document'),
    JSON_OBJECT('title', '过拟合与泛化误差复盘题', 'type', 'question_bank')
  ),
  'demo-report-generator', 1, NOW(), NOW()
);

INSERT INTO `evaluation_knowledge_mastery` (
  `id`, `user_id`, `course_id`, `knowledge_point`, `mastery_level`, `mastery_score`,
  `practice_count`, `correct_count`, `accuracy_rate`, `last_practice_time`, `create_time`, `update_time`
) VALUES
(
  910501, 1, 1, '过拟合', 3, 100.00, 1, 1, 100.00, NOW(), NOW(), NOW()
),
(
  910502, 1, 1, '泛化误差', 1, 0.00, 1, 0, 0.00, NOW(), NOW(), NOW()
),
(
  910503, 1, 1, '交叉验证', 1, 34.00, 1, 0, 34.00, NOW(), NOW(), NOW()
);

INSERT INTO `evaluation_feedback_loop` (
  `id`, `user_id`, `report_id`, `feedback_type`, `feedback_content`, `action_taken`,
  `action_time`, `action_result`, `create_time`, `update_time`
) VALUES (
  910601, 1, 920001, 2,
  JSON_OBJECT(
    'report_summary', '需要强化泛化能力评估与交叉验证的表达。',
    'recommended_resources', JSON_ARRAY(
      JSON_OBJECT('title', '模型评估专题讲义', 'type', 'document')
    ),
    'improvement_suggestions', JSON_ARRAY(
      '补做错题并重新组织口头表述',
      '结合学习路径回顾模型评估章节'
    )
  ),
  0, NULL, NULL, NOW(), NOW()
);
