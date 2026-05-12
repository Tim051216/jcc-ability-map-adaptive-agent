package com.cnsoftbei.a3.learning.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.cnsoftbei.a3.common.enums.BaseEnum;
import lombok.Getter;

/**
 * 对话会话类型枚举
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Getter
public enum SessionType implements BaseEnum {
    INITIAL_BUILD(1, "初始画像构建"),
    SUPPLEMENT(2, "画像补充"),
    VERIFICATION(3, "画像验证"),
    ;

    @JsonValue
    @EnumValue
    int value;
    String desc;

    SessionType(int value, String desc) {
        this.value = value;
        this.desc = desc;
    }

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static SessionType of(Integer value) {
        if (value == null) {
            return null;
        }
        for (SessionType type : values()) {
            if (type.equalsValue(value)) {
                return type;
            }
        }
        return null;
    }
}
