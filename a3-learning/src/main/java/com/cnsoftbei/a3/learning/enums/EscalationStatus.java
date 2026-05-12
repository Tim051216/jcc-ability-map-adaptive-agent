package com.cnsoftbei.a3.learning.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * 升级处理状态枚举
 *
 * @author A3 Team
 * @since 2024-01-10
 */
@Getter
public enum EscalationStatus {
    
    PENDING_ASSIGN(0, "待分配"),
    ASSIGNED(1, "已分配"),
    IN_PROGRESS(2, "处理中"),
    COMPLETED(3, "已完成"),
    CANCELLED(4, "已取消");

    @EnumValue
    @JsonValue
    private final Integer value;
    private final String desc;

    EscalationStatus(Integer value, String desc) {
        this.value = value;
        this.desc = desc;
    }

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static EscalationStatus of(Integer value) {
        if (value == null) {
            return null;
        }
        for (EscalationStatus status : values()) {
            if (status.value.equals(value)) {
                return status;
            }
        }
        return null;
    }
}
