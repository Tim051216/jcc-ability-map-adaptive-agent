package com.cnsoftbei.a3.learning.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * 难度层级枚举
 *
 * @author A3 Team
 * @since 2026-05-09
 */
@Getter
public enum DifficultyLevel {

    BASIC(1, "基础"),
    INTERMEDIATE(2, "进阶"),
    ADVANCED(3, "拔高");

    @EnumValue
    @JsonValue
    private final Integer value;
    private final String desc;

    DifficultyLevel(Integer value, String desc) {
        this.value = value;
        this.desc = desc;
    }
}
