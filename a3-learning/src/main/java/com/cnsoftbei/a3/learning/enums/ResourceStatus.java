package com.cnsoftbei.a3.learning.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * 资源状态枚举
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Getter
public enum ResourceStatus {

    GENERATING(1, "生成中"),
    COMPLETED(2, "已完成"),
    FAILED(3, "生成失败");

    @EnumValue
    @JsonValue
    private final Integer value;
    private final String desc;

    ResourceStatus(Integer value, String desc) {
        this.value = value;
        this.desc = desc;
    }

    /**
     * 根据值获取枚举
     */
    public static ResourceStatus of(Integer value) {
        if (value == null) {
            return null;
        }
        for (ResourceStatus status : values()) {
            if (status.value.equals(value)) {
                return status;
            }
        }
        return null;
    }
}
