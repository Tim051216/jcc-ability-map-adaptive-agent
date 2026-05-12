package com.cnsoftbei.a3.learning.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * 解答来源枚举
 *
 * @author A3 Team
 * @since 2024-01-10
 */
@Getter
public enum AnswerSource {
    
    AI_GENERATED(0, "AI生成"),
    HUMAN_EXPERT(1, "人工解答");

    @EnumValue
    @JsonValue
    private final Integer value;
    private final String desc;

    AnswerSource(Integer value, String desc) {
        this.value = value;
        this.desc = desc;
    }

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static AnswerSource of(Integer value) {
        if (value == null) {
            return null;
        }
        for (AnswerSource source : values()) {
            if (source.value.equals(value)) {
                return source;
            }
        }
        return null;
    }
}
