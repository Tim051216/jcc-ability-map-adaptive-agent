package com.cnsoftbei.a3.learning.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.cnsoftbei.a3.common.enums.BaseEnum;
import lombok.Getter;

/**
 * 对话会话状态枚举
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Getter
public enum ConversationStatus implements BaseEnum {
    IN_PROGRESS(0, "进行中"),
    COMPLETED(1, "已完成"),
    INTERRUPTED(2, "已中断"),
    ;

    @JsonValue
    @EnumValue
    int value;
    String desc;

    ConversationStatus(int value, String desc) {
        this.value = value;
        this.desc = desc;
    }

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static ConversationStatus of(Integer value) {
        if (value == null) {
            return null;
        }
        for (ConversationStatus status : values()) {
            if (status.equalsValue(value)) {
                return status;
            }
        }
        return null;
    }
}
