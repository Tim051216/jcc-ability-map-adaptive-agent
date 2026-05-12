package com.cnsoftbei.a3.learning.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * 知识点掌握程度枚举
 *
 * @author A3 Team
 * @since 2026-05-09
 */
@Getter
public enum MasteryLevel {

    NOT_LEARNED(0, "未学习"),
    BASIC_UNDERSTANDING(1, "初步了解"),
    BASIC_MASTERY(2, "基本掌握"),
    PROFICIENT(3, "熟练掌握"),
    EXPERT(4, "精通");

    @EnumValue
    @JsonValue
    private final Integer value;
    private final String desc;

    MasteryLevel(Integer value, String desc) {
        this.value = value;
        this.desc = desc;
    }
}
