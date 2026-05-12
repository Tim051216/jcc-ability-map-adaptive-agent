package com.cnsoftbei.a3.learning.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.cnsoftbei.a3.common.enums.BaseEnum;
import lombok.Getter;

/**
 * 画像变更类型枚举
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Getter
public enum ProfileChangeType implements BaseEnum {
    INITIAL_CREATE(1, "初始创建"),
    CONVERSATION_UPDATE(2, "对话更新"),
    BEHAVIOR_UPDATE(3, "行为更新"),
    MANUAL_ADJUST(4, "手动调整"),
    ;

    @JsonValue
    @EnumValue
    int value;
    String desc;

    ProfileChangeType(int value, String desc) {
        this.value = value;
        this.desc = desc;
    }

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static ProfileChangeType of(Integer value) {
        if (value == null) {
            return null;
        }
        for (ProfileChangeType type : values()) {
            if (type.equalsValue(value)) {
                return type;
            }
        }
        return null;
    }
}
