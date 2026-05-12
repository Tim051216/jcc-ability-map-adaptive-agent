package com.cnsoftbei.a3.learning.domain.po;

import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.Accessors;

import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.LocalDateTime;

/**
 * <p>
 * 学习日历任务表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName(value = "learning_calendar", autoResultMap = true)
@ApiModel(value = "LearningCalendar对象", description = "学习日历任务表")
public class LearningCalendar implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "任务ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "用户ID")
    private Long userId;

    @ApiModelProperty(value = "关联路径ID")
    private Long pathId;

    @ApiModelProperty(value = "关联节点ID")
    private Long nodeId;

    @ApiModelProperty(value = "任务标题")
    private String taskTitle;

    @ApiModelProperty(value = "任务描述")
    private String taskDesc;

    @ApiModelProperty(value = "任务类型：1-路径节点任务，2-测评任务，3-自定义任务")
    private Integer taskType;

    @ApiModelProperty(value = "计划日期")
    private LocalDate planDate;

    @ApiModelProperty(value = "计划开始时间")
    private LocalTime planStartTime;

    @ApiModelProperty(value = "计划结束时间")
    private LocalTime planEndTime;

    @ApiModelProperty(value = "预估时长（分钟）")
    private Integer estimatedDuration;

    @ApiModelProperty(value = "任务状态：0-待开始，1-进行中，2-已完成，3-已逾期，4-已取消")
    private Integer status;

    @ApiModelProperty(value = "优先级：1-低，2-中，3-高")
    private Integer priority;

    @ApiModelProperty(value = "是否启用提醒")
    private Boolean reminderEnabled;

    @ApiModelProperty(value = "提醒时间")
    private LocalDateTime reminderTime;

    @ApiModelProperty(value = "提醒是否已发送")
    private Boolean reminderSent;

    @ApiModelProperty(value = "实际开始时间")
    private LocalDateTime actualStartTime;

    @ApiModelProperty(value = "实际结束时间")
    private LocalDateTime actualEndTime;

    @ApiModelProperty(value = "实际时长（分钟）")
    private Integer actualDuration;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
