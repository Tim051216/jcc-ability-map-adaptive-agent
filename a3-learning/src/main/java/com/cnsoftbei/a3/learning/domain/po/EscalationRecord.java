package com.cnsoftbei.a3.learning.domain.po;

import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.IdType;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import com.baomidou.mybatisplus.annotation.TableId;
import java.io.Serializable;

import com.cnsoftbei.a3.learning.enums.EscalationReason;
import com.cnsoftbei.a3.learning.enums.EscalationStatus;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.Accessors;

/**
 * <p>
 * 升级记录表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-10
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("escalation_record")
@ApiModel(value="EscalationRecord对象", description="升级记录表")
public class EscalationRecord implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "升级记录ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "关联问题ID")
    private Long questionId;

    @ApiModelProperty(value = "所属会话ID")
    private Long sessionId;

    @ApiModelProperty(value = "学生ID")
    private Long userId;

    @ApiModelProperty(value = "升级原因：1-置信度低，2-生成超时，3-用户主动请求，4-多次解答不满意")
    private EscalationReason escalationReason;

    @ApiModelProperty(value = "AI解答置信度（触发升级时）")
    private BigDecimal aiConfidenceScore;

    @ApiModelProperty(value = "处理状态：0-待分配，1-已分配，2-处理中，3-已完成，4-已取消")
    private EscalationStatus escalationStatus;

    @ApiModelProperty(value = "分配的专家ID")
    private Long assignedExpertId;

    @ApiModelProperty(value = "分配时间")
    private LocalDateTime assignTime;

    @ApiModelProperty(value = "专家解答ID")
    private Long expertAnswerId;

    @ApiModelProperty(value = "完成时间")
    private LocalDateTime completeTime;

    @ApiModelProperty(value = "响应时长（分钟）")
    private Integer responseTime;

    @ApiModelProperty(value = "专家备注")
    private String expertNotes;

    @ApiModelProperty(value = "是否已反馈给AI系统")
    private Boolean feedbackToAi;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
