package com.cnsoftbei.a3.learning.domain.vo;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 学习路径详情返回
 */
@Data
@ApiModel(value = "学习路径VO")
public class LearningPathVO {

    @ApiModelProperty("路径ID")
    private Long id;

    @ApiModelProperty("学生用户ID")
    private Long userId;

    @ApiModelProperty("关联画像ID")
    private Long profileId;

    @ApiModelProperty("路径名称")
    private String pathName;

    @ApiModelProperty("路径描述")
    private String pathDesc;

    @ApiModelProperty("目标课程ID")
    private Long targetCourseId;

    @ApiModelProperty("目标知识点（解析后）")
    private List<String> targetKnowledgePoints;

    @ApiModelProperty("路径状态")
    private Integer status;

    @ApiModelProperty("路径类型")
    private Integer pathType;

    @ApiModelProperty("总节点数")
    private Integer totalNodes;

    @ApiModelProperty("已完成节点数")
    private Integer completedNodes;

    @ApiModelProperty("当前节点ID")
    private Long currentNodeId;

    @ApiModelProperty("完成百分比")
    private Integer progressPercentage;

    @ApiModelProperty("预估总时长（分钟）")
    private Integer estimatedDuration;

    @ApiModelProperty("实际学习时长（分钟）")
    private Integer actualDuration;

    @ApiModelProperty("难度等级")
    private Integer difficultyLevel;

    @ApiModelProperty("是否自适应")
    private Boolean adaptiveEnabled;

    @ApiModelProperty("创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty("激活时间")
    private LocalDateTime activateTime;

    @ApiModelProperty("开始学习时间")
    private LocalDateTime startTime;

    @ApiModelProperty("完成时间")
    private LocalDateTime completeTime;

    @ApiModelProperty("更新时间")
    private LocalDateTime updateTime;
}
