package com.cnsoftbei.a3.learning.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.cnsoftbei.a3.common.enums.BaseEnum;
import lombok.Getter;

/**
 * 画像状态枚举
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Getter
public enum ProfileStatus implements BaseEnum {
    INACTIVE(0, "未激活"),
    ACTIVE(1, "正常"),
    EXPIRED(2, "已过期"),
    ;

    @JsonValue
    @EnumValue
    int value;
    String desc;

    ProfileStatus(int value, String desc) {
        this.value = value;
        this.desc = desc;
    }

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static ProfileStatus of(Integer value) {
        if (value == null) {
            return null;
        }
        for (ProfileStatus status : values()) {
            if (status.equalsValue(value)) {
                return status;
            }
        }
        return null;
    }
}
