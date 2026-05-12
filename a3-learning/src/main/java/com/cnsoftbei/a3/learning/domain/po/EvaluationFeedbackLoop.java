package com.cnsoftbei.a3.learning.domain.po;

import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.Accessors;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * <p>
 * 闭环反馈表 - 记录评估结果对学习路径的反馈调整
 * </p>
 *
 * @author A3 Team
 * @since 2026-05-09
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName(value = "evaluation_feedback_loop", autoResultMap = true)
@ApiModel(value = "EvaluationFeedbackLoop对象", description = "闭环反馈表")
public class EvaluationFeedbackLoop implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "反馈ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "学生ID")
    private Long userId;

    @ApiModelProperty(value = "评估报告ID")
    private Long reportId;

    @ApiModelProperty(value = "反馈类型: 1-学习路径调整, 2-资源推荐, 3-难度调整, 4-学习提醒")
    private Integer feedbackType;

    @ApiModelProperty(value = "反馈内容(JSON格式)")
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> feedbackContent;

    @ApiModelProperty(value = "是否已执行: 0-未执行, 1-已执行")
    private Integer actionTaken;

    @ApiModelProperty(value = "执行时间")
    private LocalDateTime actionTime;

    @ApiModelProperty(value = "执行结果")
    private String actionResult;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
