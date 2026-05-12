package com.cnsoftbei.a3.learning.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * 测评类型枚举
 *
 * @author A3 Team
 * @since 2026-05-09
 */
@Getter
public enum TestType {

    PRE_TEST(1, "课前测评"),
    IN_CLASS_PRACTICE(2, "课中练习"),
    POST_TEST(3, "课后测评"),
    STAGE_TEST(4, "阶段测试");

    @EnumValue
    @JsonValue
    private final Integer value;
    private final String desc;

    TestType(Integer value, String desc) {
        this.value = value;
        this.desc = desc;
    }
}
