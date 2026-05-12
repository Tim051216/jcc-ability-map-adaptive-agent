package com.cnsoftbei.a3.learning.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * 任务状态枚举
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Getter
public enum TaskStatus {

    PENDING(1, "待处理"),
    PROCESSING(2, "处理中"),
    COMPLETED(3, "已完成"),
    PARTIAL_FAILED(4, "部分失败"),
    ALL_FAILED(5, "全部失败");

    @EnumValue
    @JsonValue
    private final Integer value;
    private final String desc;

    TaskStatus(Integer value, String desc) {
        this.value = value;
        this.desc = desc;
    }

    /**
     * 根据值获取枚举
     */
    public static TaskStatus of(Integer value) {
        if (value == null) {
            return null;
        }
        for (TaskStatus status : values()) {
            if (status.value.equals(value)) {
                return status;
            }
        }
        return null;
    }
}
