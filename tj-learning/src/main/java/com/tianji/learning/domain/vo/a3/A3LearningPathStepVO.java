package com.tianji.learning.domain.vo.a3;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@ApiModel("学习路径步骤")
public class A3LearningPathStepVO {

    @ApiModelProperty("步骤序号")
    private Integer stepNo;

    @ApiModelProperty("步骤标题")
    private String title;

    @ApiModelProperty("学习目标")
    private String objective;

    @ApiModelProperty("推荐资源形式")
    private String resourceType;

    @ApiModelProperty("建议学习时长，单位分钟")
    private Integer estimatedMinutes;

    @ApiModelProperty("负责智能体")
    private String agentRole;
}
