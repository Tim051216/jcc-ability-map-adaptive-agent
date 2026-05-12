package com.cnsoftbei.a3.learning.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * 辅导问题状态枚举
 *
 * @author A3 Team
 * @since 2024-01-10
 */
@Getter
public enum TutoringQuestionStatus {
    
    PENDING(0, "待处理"),
    ANSWERED(1, "已解答"),
    ESCALATED(2, "已升级"),
    CLOSED(3, "已关闭");

    @EnumValue
    @JsonValue
    private final Integer value;
    private final String desc;

    TutoringQuestionStatus(Integer value, String desc) {
        this.value = value;
        this.desc = desc;
    }

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static TutoringQuestionStatus of(Integer value) {
        if (value == null) {
            return null;
        }
        for (TutoringQuestionStatus status : values()) {
            if (status.value.equals(value)) {
                return status;
            }
        }
        return null;
    }
}
