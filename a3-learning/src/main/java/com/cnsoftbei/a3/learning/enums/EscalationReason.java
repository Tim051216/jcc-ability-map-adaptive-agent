package com.cnsoftbei.a3.learning.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;

/**
 * 升级原因枚举
 *
 * @author A3 Team
 * @since 2024-01-10
 */
@Getter
public enum EscalationReason {
    
    LOW_CONFIDENCE(1, "置信度低"),
    TIMEOUT(2, "生成超时"),
    USER_REQUEST(3, "用户主动请求"),
    UNSATISFIED(4, "多次解答不满意");

    @EnumValue
    @JsonValue
    private final Integer value;
    private final String desc;

    EscalationReason(Integer value, String desc) {
        this.value = value;
        this.desc = desc;
    }

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static EscalationReason of(Integer value) {
        if (value == null) {
            return null;
        }
        for (EscalationReason reason : values()) {
            if (reason.value.equals(value)) {
                return reason;
            }
        }
        return null;
    }
}
