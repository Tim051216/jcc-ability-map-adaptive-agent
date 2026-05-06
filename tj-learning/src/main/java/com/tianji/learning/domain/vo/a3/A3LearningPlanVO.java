package com.tianji.learning.domain.vo.a3;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@ApiModel("个性化学习路径")
public class A3LearningPlanVO {

    @ApiModelProperty("路径标题")
    private String title;

    @ApiModelProperty("建议学习节奏")
    private String paceSuggestion;

    @ApiModelProperty("动态调整建议")
    private String adjustmentSuggestion;

    @ApiModelProperty("学习路径步骤")
    private List<A3LearningPathStepVO> steps;
}
