package com.cnsoftbei.a3.learning.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * 评估报告类型枚举
 *
 * @author A3 Team
 * @since 2026-05-09
 */
@Getter
public enum ReportType {

    SINGLE_TEST(1, "单次测评报告"),
    STAGE_REPORT(2, "阶段性报告"),
    COMPREHENSIVE(3, "综合报告");

    @EnumValue
    @JsonValue
    private final Integer value;
    private final String desc;

    ReportType(Integer value, String desc) {
        this.value = value;
        this.desc = desc;
    }
}
