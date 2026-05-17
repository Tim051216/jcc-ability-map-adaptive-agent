USE `learning`;

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
  'Model Evaluation Demo Test',
  'Local demo paper for learning evaluation flow.',
  4, 2, 1, NULL, NULL,
  JSON_ARRAY('overfitting', 'generalization', 'cross validation'),
  100, 60, 30, 3, 1, 1, NOW(), NOW()
);

INSERT INTO `evaluation_question` (
  `id`, `test_id`, `question_type`, `difficulty_level`, `knowledge_point`,
  `question_content`, `question_options`, `correct_answer`, `answer_analysis`,
  `score`, `order_num`, `generation_prompt`, `generation_model`, `quality_score`,
  `status`, `create_time`, `update_time`
) VALUES
(
  910101, 910001, 1, 1, 'overfitting',
  'Which sign best indicates that a model is overfitting?',
  JSON_ARRAY(
    JSON_OBJECT('label', 'A. High train accuracy with much lower validation accuracy', 'value', 'A'),
    JSON_OBJECT('label', 'B. Train and validation accuracy rise together', 'value', 'B'),
    JSON_OBJECT('label', 'C. Fewer parameters and faster inference', 'value', 'C'),
    JSON_OBJECT('label', 'D. Loss drops after increasing learning rate', 'value', 'D')
  ),
  'A',
  'Overfitting usually appears when a model fits seen data well but performs poorly on unseen validation data.',
  30.00, 1, NULL, NULL, 0.95, 1, NOW(), NOW()
),
(
  910102, 910001, 1, 2, 'generalization',
  'Which action is more appropriate for evaluating model generalization?',
  JSON_ARRAY(
    JSON_OBJECT('label', 'A. Look only at training loss', 'value', 'A'),
    JSON_OBJECT('label', 'B. Use cross validation and inspect validation performance', 'value', 'B'),
    JSON_OBJECT('label', 'C. Train on the test set too', 'value', 'C'),
    JSON_OBJECT('label', 'D. Add more layers only', 'value', 'D')
  ),
  'B',
  'Cross validation offers a more stable view of performance across different data splits.',
  35.00, 2, NULL, NULL, 0.94, 1, NOW(), NOW()
),
(
  910103, 910001, 5, 2, 'cross validation',
  'Why is training accuracy alone not enough to judge a model?',
  NULL,
  'Training accuracy reflects performance on seen data only. Generalization must also be checked with validation or test data.',
  'Strong training accuracy does not guarantee good generalization. Validation evidence is required.',
  35.00, 3, NULL, NULL, 0.90, 1, NOW(), NOW()
);

INSERT INTO `evaluation_answer_record` (
  `id`, `test_id`, `question_id`, `user_id`, `user_answer`, `is_correct`, `score`,
  `grading_type`, `grading_feedback`, `grading_model`, `answer_time`, `submit_time`,
  `grading_time`, `create_time`, `update_time`
) VALUES
(
  910201, 910001, 910101, 1, 'A', 1, 30.00, 1,
  'Correct. You identified the classic gap between train and validation performance.',
  NULL, 45, NOW(), NOW(), NOW(), NOW()
),
(
  910202, 910001, 910102, 1, 'D', 0, 0.00, 1,
  'Incorrect. Adding layers alone does not evaluate generalization. Cross validation is the better answer.',
  NULL, 52, NOW(), NOW(), NOW(), NOW()
),
(
  910203, 910001, 910103, 1,
  'High training accuracy means the model is already good.',
  0, 12.00, 2,
  'The answer ignores validation or test evidence, so it does not address generalization risk clearly enough.',
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
  910401, 1, 910102, 910001, 910202, 'generalization', 1, 0, NOW(), NULL, NOW(), NOW()
),
(
  910402, 1, 910103, 910001, 910203, 'cross validation', 1, 0, NOW(), NULL, NOW(), NOW()
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
      JSON_OBJECT('knowledge_point', 'overfitting', 'accuracy_rate', 100, 'mastery_level', 3, 'total_questions', 1, 'correct_count', 1),
      JSON_OBJECT('knowledge_point', 'generalization', 'accuracy_rate', 0, 'mastery_level', 1, 'total_questions', 1, 'correct_count', 0),
      JSON_OBJECT('knowledge_point', 'cross validation', 'accuracy_rate', 34, 'mastery_level', 1, 'total_questions', 1, 'correct_count', 0)
    )
  ),
  JSON_OBJECT(
    'dimensions', JSON_ARRAY(
      JSON_OBJECT('level_name', 'basic understanding', 'accuracy_rate', 100),
      JSON_OBJECT('level_name', 'metric judgment', 'accuracy_rate', 0),
      JSON_OBJECT('level_name', 'explanation quality', 'accuracy_rate', 34)
    )
  ),
  JSON_OBJECT(
    'overall_efficiency', 58,
    'time_efficiency', 64,
    'accuracy_rate', 33.33,
    'efficiency_level', 'needs improvement',
    'time_spent_minutes', 3
  ),
  'The learner correctly recognized the most direct sign of overfitting.',
  'Generalization evaluation is weak, and the written explanation does not mention validation evidence clearly enough.',
  'Review cross validation, revisit the generalization topic, and redo the wrong questions before the next report run.',
  JSON_ARRAY(
    JSON_OBJECT('title', 'Model evaluation notes', 'type', 'document'),
    JSON_OBJECT('title', 'Generalization repair set', 'type', 'question_bank')
  ),
  'demo-report-generator', 1, NOW(), NOW()
);

INSERT INTO `evaluation_knowledge_mastery` (
  `id`, `user_id`, `course_id`, `knowledge_point`, `mastery_level`, `mastery_score`,
  `practice_count`, `correct_count`, `accuracy_rate`, `last_practice_time`, `create_time`, `update_time`
) VALUES
(
  910501, 1, 1, 'overfitting', 3, 100.00, 1, 1, 100.00, NOW(), NOW(), NOW()
),
(
  910502, 1, 1, 'generalization', 1, 0.00, 1, 0, 0.00, NOW(), NOW(), NOW()
),
(
  910503, 1, 1, 'cross validation', 1, 34.00, 1, 0, 34.00, NOW(), NOW(), NOW()
);

INSERT INTO `evaluation_feedback_loop` (
  `id`, `user_id`, `report_id`, `feedback_type`, `feedback_content`, `action_taken`,
  `action_time`, `action_result`, `create_time`, `update_time`
) VALUES (
  910601, 1, 920001, 2,
  JSON_OBJECT(
    'report_summary', 'Strengthen generalization evaluation and cross validation explanation.',
    'recommended_resources', JSON_ARRAY(
      JSON_OBJECT('title', 'Model evaluation notes', 'type', 'document')
    ),
    'improvement_suggestions', JSON_ARRAY(
      'Redo the wrong questions',
      'Revisit the learning path section for model evaluation'
    )
  ),
  0, NULL, NULL, NOW(), NOW()
);
