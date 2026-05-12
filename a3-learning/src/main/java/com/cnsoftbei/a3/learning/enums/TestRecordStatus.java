package com.cnsoftbei.a3.learning.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * 测评记录状态枚举
 *
 * @author A3 Team
 * @since 2026-05-09
 */
@Getter
public enum TestRecordStatus {

    IN_PROGRESS(0, "进行中"),
    SUBMITTED(1, "已提交"),
    GRADED(2, "已批改");

    @EnumValue
    @JsonValue
    private final Integer value;
    private final String desc;

    TestRecordStatus(Integer value, String desc) {
        this.value = value;
        this.desc = desc;
    }
}
