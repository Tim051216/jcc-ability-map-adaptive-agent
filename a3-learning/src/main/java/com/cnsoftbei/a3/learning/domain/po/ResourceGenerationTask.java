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
import java.time.LocalDateTime;

/**
 * <p>
 * 资源生成任务表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("resource_generation_task")
@ApiModel(value = "ResourceGenerationTask对象", description = "资源生成任务表")
public class ResourceGenerationTask implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "任务ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "任务名称")
    private String taskName;

    @ApiModelProperty(value = "学生ID")
    private Long studentId;

    @ApiModelProperty(value = "资源类型列表（逗号分隔）：1,2,3,4,5")
    private String resourceTypes;

    @ApiModelProperty(value = "知识点ID")
    private Long knowledgePointId;

    @ApiModelProperty(value = "课程ID")
    private Long courseId;

    @ApiModelProperty(value = "章节ID")
    private Long chapterId;

    @ApiModelProperty(value = "小节ID")
    private Long sectionId;

    @ApiModelProperty(value = "生成参数（JSON格式）")
    private String generationParams;

    @ApiModelProperty(value = "任务状态：1-待处理，2-处理中，3-已完成，4-部分失败，5-全部失败")
    private Integer taskStatus;

    @ApiModelProperty(value = "任务进度（0-100）")
    private Integer progress;

    @ApiModelProperty(value = "计划生成资源数")
    private Integer totalResources;

    @ApiModelProperty(value = "已完成资源数")
    private Integer completedResources;

    @ApiModelProperty(value = "失败资源数")
    private Integer failedResources;

    @ApiModelProperty(value = "错误信息")
    private String errorMessage;

    @ApiModelProperty(value = "开始时间")
    private LocalDateTime startTime;

    @ApiModelProperty(value = "结束时间")
    private LocalDateTime endTime;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
