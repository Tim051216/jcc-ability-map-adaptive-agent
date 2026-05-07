package com.cnsoftbei.a3.learning.domain.vo.a3;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@ApiModel("多智能体阶段结果")
public class A3AgentStageVO {

    @ApiModelProperty("阶段名称")
    private String stageName;

    @ApiModelProperty("智能体角色")
    private String agentRole;

    @ApiModelProperty("阶段输出摘要")
    private String outputSummary;
}
