package com.cnsoftbei.a3.learning.domain.dto;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.util.List;

/**
 * 创建学习路径时的规划参数
 */
@Data
@ApiModel(value = "路径规划DTO")
public class PathPlanningDTO {

    @ApiModelProperty("已废弃：创建路径始终以登录上下文用户为准，传此字段无效")
    @Deprecated
    private Long userId;

    @ApiModelProperty("关联的学生画像ID")
    private Long profileId;

    @ApiModelProperty(value = "路径名称", required = true)
    @NotBlank(message = "路径名称不能为空")
    private String pathName;

    @ApiModelProperty("路径描述")
    private String pathDesc;

    @ApiModelProperty(value = "目标课程ID", required = true)
    @NotNull(message = "目标课程ID不能为空")
    private Long targetCourseId;

    @ApiModelProperty("目标知识点")
    private List<String> targetKnowledgePoints;

    @ApiModelProperty("路径类型：1-AI自动规划，2-教师指定，3-混合模式")
    private Integer pathType;

    @ApiModelProperty("整体难度等级：1-入门 … 5-专家")
    private Integer difficultyLevel;

    @ApiModelProperty("是否启用自适应调整")
    private Boolean adaptiveEnabled;

    @ApiModelProperty("预估总时长（分钟）")
    private Integer estimatedDuration;

    @ApiModelProperty("自动生成演示阶梯节点（未接通 AI 规划时用于快速占位与演示）")
    private Boolean seedDemoNodes;
}
