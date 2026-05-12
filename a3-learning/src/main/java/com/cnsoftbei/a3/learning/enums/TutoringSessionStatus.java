package com.cnsoftbei.a3.learning.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * 答疑会话状态枚举
 *
 * @author A3 Team
 * @since 2024-01-10
 */
@Getter
public enum TutoringSessionStatus {
    
    IN_PROGRESS(0, "进行中"),
    ENDED(1, "已结束"),
    ESCALATED(2, "已升级");

    @EnumValue
    @JsonValue
    private final Integer value;
    private final String desc;

    TutoringSessionStatus(Integer value, String desc) {
        this.value = value;
        this.desc = desc;
    }

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static TutoringSessionStatus of(Integer value) {
        if (value == null) {
            return null;
        }
        for (TutoringSessionStatus status : values()) {
            if (status.value.equals(value)) {
                return status;
            }
        }
        return null;
    }
}
