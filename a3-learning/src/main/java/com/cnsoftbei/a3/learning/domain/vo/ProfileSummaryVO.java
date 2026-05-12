package com.cnsoftbei.a3.learning.domain.vo;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * 学生画像摘要视图对象
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@ApiModel(description = "学生画像摘要")
public class ProfileSummaryVO {

    @ApiModelProperty("画像ID")
    private Long id;

    @ApiModelProperty("学生用户ID")
    private Long userId;

    @ApiModelProperty("画像完整度百分比(0-100)")
    private Integer completeness;

    @ApiModelProperty("学习标签列表")
    private List<String> tags;

    @ApiModelProperty("关键特征描述")
    private String keyFeatures;

    @ApiModelProperty("各维度完整度")
    private Map<String, Integer> dimensionCompleteness;

    @ApiModelProperty("推荐学习方式")
    private String recommendedLearningStyle;

    @ApiModelProperty("当前学习阶段")
    private String currentStage;
}
