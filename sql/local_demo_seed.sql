USE `tj_learning`;

-- Deterministic demo seed for local student and AI-linked flows.

DELETE FROM `interaction_reply` WHERE `id` IN (930101, 930102, 930103, 930201, 930202);
DELETE FROM `interaction_question` WHERE `id` IN (930001, 930002, 930003);
DELETE FROM `learning_record` WHERE `lesson_id` IN (10100, 30200, 40100) AND `user_id` = 1001;
DELETE FROM `learning_lesson` WHERE `id` IN (10100, 30200, 40100);

INSERT INTO `learning_lesson`
    (`id`, `user_id`, `course_id`, `status`, `week_freq`, `plan_status`, `learned_sections`, `latest_section_id`, `latest_learn_time`, `create_time`, `expire_time`, `update_time`)
VALUES
    (10100, 1001, 101, 1, 3, 1, 2, 10112, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 14 DAY, NOW() + INTERVAL 180 DAY, NOW()),
    (30200, 1001, 302, 1, 2, 1, 1, 30211, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 10 DAY, NOW() + INTERVAL 180 DAY, NOW()),
    (40100, 1001, 401, 1, 4, 1, 3, 40121, NOW() - INTERVAL 3 HOUR, NOW() - INTERVAL 7 DAY, NOW() + INTERVAL 365 DAY, NOW());

INSERT INTO `learning_record`
    (`id`, `lesson_id`, `section_id`, `user_id`, `moment`, `finished`, `create_time`, `finish_time`, `update_time`)
VALUES
    (940101, 10100, 10111, 1001, 540, b'1', NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY),
    (940102, 10100, 10112, 1001, 420, b'0', NOW() - INTERVAL 2 DAY, NULL, NOW() - INTERVAL 2 DAY),
    (940201, 30200, 30211, 1001, 530, b'1', NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY),
    (940301, 40100, 40111, 1001, 900, b'1', NOW() - INTERVAL 6 DAY, NOW() - INTERVAL 6 DAY, NOW() - INTERVAL 6 DAY),
    (940302, 40100, 40112, 1001, 960, b'1', NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY),
    (940303, 40100, 40121, 1001, 615, b'0', NOW() - INTERVAL 3 HOUR, NULL, NOW() - INTERVAL 3 HOUR);

INSERT INTO `interaction_question`
    (`id`, `title`, `description`, `course_id`, `chapter_id`, `section_id`, `user_id`, `latest_answer_id`, `answer_times`, `anonymity`, `hidden`, `status`, `create_time`, `update_time`)
VALUES
    (
        930001,
        'Which software engineering section is best for the main demo flow?',
        'I want to connect course intro, learning path, resource generation, and report pages into one story for the final demo.',
        401,
        4011,
        40111,
        1001,
        930102,
        1,
        b'0',
        b'0',
        0,
        NOW() - INTERVAL 2 DAY,
        NOW() - INTERVAL 1 DAY
    ),
    (
        930002,
        'Which inputs should I emphasize on the resource generation page?',
        'Reviewers keep asking why the generated resources are personalized, so I want a short and stable explanation.',
        101,
        1012,
        10121,
        1001,
        930201,
        1,
        b'0',
        b'0',
        0,
        NOW() - INTERVAL 1 DAY,
        NOW() - INTERVAL 12 HOUR
    ),
    (
        930003,
        'What is the safest presentation order for the contest practice course?',
        'I want a clean narrative from requirement breakdown to work split and acceptance review.',
        302,
        3021,
        30211,
        1001,
        930202,
        1,
        b'1',
        b'0',
        0,
        NOW() - INTERVAL 8 HOUR,
        NOW() - INTERVAL 2 HOUR
    );

INSERT INTO `interaction_reply`
    (`id`, `question_id`, `answer_id`, `user_id`, `content`, `target_user_id`, `target_reply_id`, `reply_times`, `liked_times`, `hidden`, `anonymity`, `create_time`, `update_time`)
VALUES
    (
        930101,
        930001,
        0,
        1001,
        'I am leaning toward course intro first, then path and resource pages, but I am not sure whether that feels too scattered.',
        0,
        0,
        1,
        0,
        b'0',
        b'0',
        NOW() - INTERVAL 36 HOUR,
        NOW() - INTERVAL 36 HOUR
    ),
    (
        930102,
        930001,
        930101,
        1001,
        'Start from section 40111 and use course positioning as the opening, then move through learning path, resources, and report pages.',
        1001,
        930101,
        0,
        3,
        b'0',
        b'0',
        NOW() - INTERVAL 24 HOUR,
        NOW() - INTERVAL 24 HOUR
    ),
    (
        930201,
        930002,
        0,
        1001,
        'Show learner profile, course context, and knowledge source on one screen so the audience can see why the resource is not a static template.',
        0,
        0,
        0,
        5,
        b'0',
        b'0',
        NOW() - INTERVAL 12 HOUR,
        NOW() - INTERVAL 12 HOUR
    ),
    (
        930202,
        930003,
        0,
        1001,
        'Explain problem breakdown and goal boundaries first, then roles, and close from the acceptance point of view.',
        0,
        0,
        0,
        1,
        b'0',
        b'1',
        NOW() - INTERVAL 2 HOUR,
        NOW() - INTERVAL 2 HOUR
    ),
    (
        930103,
        930001,
        930101,
        1001,
        'Understood. I will use the reason for leading with course positioning as the transition sentence.',
        1001,
        930102,
        0,
        0,
        b'0',
        b'0',
        NOW() - INTERVAL 20 HOUR,
        NOW() - INTERVAL 20 HOUR
    );
