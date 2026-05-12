package com.cnsoftbei.a3.learning.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.cnsoftbei.a3.common.enums.BaseEnum;
import lombok.Getter;

/**
 * 学习行为类型枚举
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Getter
public enum BehaviorType implements BaseEnum {
    ANSWER_QUESTION(1, "答题"),
    BROWSE_RESOURCE(2, "资源浏览"),
    COMPLETE_PATH(3, "路径完成"),
    INTERACTION(4, "互动问答"),
    ;

    @JsonValue
    @EnumValue
    int value;
    String desc;

    BehaviorType(int value, String desc) {
        this.value = value;
        this.desc = desc;
    }

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static BehaviorType of(Integer value) {
        if (value == null) {
            return null;
        }
        for (BehaviorType type : values()) {
            if (type.equalsValue(value)) {
                return type;
            }
        }
        return null;
    }
}
