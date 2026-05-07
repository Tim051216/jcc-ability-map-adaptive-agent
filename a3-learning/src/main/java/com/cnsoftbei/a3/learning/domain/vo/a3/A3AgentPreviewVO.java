package com.cnsoftbei.a3.learning.domain.vo.a3;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@ApiModel("A3赛题多智能体协同预览")
public class A3AgentPreviewVO {

    @ApiModelProperty("学生画像")
    private A3StudentProfileVO profile;

    @ApiModelProperty("资源生成方案")
    private A3ResourcePlanVO resourcePlan;

    @ApiModelProperty("学习路径")
    private A3LearningPlanVO learningPlan;

    @ApiModelProperty("智能体协同阶段")
    private List<A3AgentStageVO> stages;
}
