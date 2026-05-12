package com.cnsoftbei.a3.learning.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * 题目类型枚举
 *
 * @author A3 Team
 * @since 2026-05-09
 */
@Getter
public enum QuestionType {

    SINGLE_CHOICE(1, "单选题"),
    MULTIPLE_CHOICE(2, "多选题"),
    TRUE_FALSE(3, "判断题"),
    FILL_BLANK(4, "填空题"),
    SHORT_ANSWER(5, "简答题"),
    PROGRAMMING(6, "编程题");

    @EnumValue
    @JsonValue
    private final Integer value;
    private final String desc;

    QuestionType(Integer value, String desc) {
        this.value = value;
        this.desc = desc;
    }
}
