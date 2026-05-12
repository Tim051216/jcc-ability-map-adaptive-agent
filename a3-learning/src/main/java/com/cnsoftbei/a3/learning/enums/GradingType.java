package com.cnsoftbei.a3.learning.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * 批改类型枚举
 *
 * @author A3 Team
 * @since 2026-05-09
 */
@Getter
public enum GradingType {

    AUTO_GRADING(1, "自动批改"),
    AI_GRADING(2, "AI批改"),
    MANUAL_GRADING(3, "人工批改");

    @EnumValue
    @JsonValue
    private final Integer value;
    private final String desc;

    GradingType(Integer value, String desc) {
        this.value = value;
        this.desc = desc;
    }
}
