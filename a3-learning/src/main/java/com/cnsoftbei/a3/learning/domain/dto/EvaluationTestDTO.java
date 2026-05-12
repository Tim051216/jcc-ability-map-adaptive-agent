package com.cnsoftbei.a3.learning.domain.dto;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.util.List;

/**
 * 测评创建/更新 DTO
 *
 * @author A3 Team
 * @since 2026-05-09
 */
@Data
@ApiModel(value = "测评DTO", description = "测评创建和更新数据传输对象")
public class EvaluationTestDTO {

    @ApiModelProperty(value = "测评ID (更新时必填)")
    private Long id;

    @ApiModelProperty(value = "测评标题", required = true)
    @NotBlank(message = "测评标题不能为空")
    private String title;

    @ApiModelProperty(value = "测评描述")
    private String description;

    @ApiModelProperty(value = "测评类型: 1-课前测评, 2-课中练习, 3-课后测评, 4-阶段测试", required = true)
    @NotNull(message = "测评类型不能为空")
    private Integer testType;

    @ApiModelProperty(value = "难度层级: 1-基础, 2-进阶, 3-拔高", required = true)
    @NotNull(message = "难度层级不能为空")
    private Integer difficultyLevel;

    @ApiModelProperty(value = "关联课程ID", required = true)
    @NotNull(message = "课程ID不能为空")
    private Long courseId;

    @ApiModelProperty(value = "关联章节ID")
    private Long chapterId;

    @ApiModelProperty(value = "关联小节ID")
    private Long sectionId;

    @ApiModelProperty(value = "关联知识点列表")
    private List<String> knowledgePoints;

    @ApiModelProperty(value = "总分")
    private Integer totalScore;

    @ApiModelProperty(value = "及格分")
    private Integer passScore;

    @ApiModelProperty(value = "时间限制(分钟)")
    private Integer timeLimit;
}
