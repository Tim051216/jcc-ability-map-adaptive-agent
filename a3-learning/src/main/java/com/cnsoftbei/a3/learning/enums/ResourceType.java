package com.cnsoftbei.a3.learning.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * 资源类型枚举
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Getter
public enum ResourceType {

    DOCUMENT(1, "课程讲解文档"),
    MINDMAP(2, "知识点思维导图"),
    QUESTION_BANK(3, "分层练习题库"),
    VIDEO(4, "教学视频/动画"),
    CODE_EXAMPLE(5, "代码实操案例");

    @EnumValue
    @JsonValue
    private final Integer value;
    private final String desc;

    ResourceType(Integer value, String desc) {
        this.value = value;
        this.desc = desc;
    }

    /**
     * 根据值获取枚举
     */
    public static ResourceType of(Integer value) {
        if (value == null) {
            return null;
        }
        for (ResourceType type : values()) {
            if (type.value.equals(value)) {
                return type;
            }
        }
        return null;
    }
}
