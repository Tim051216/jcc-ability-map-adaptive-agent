package com.cnsoftbei.a3.learning.domain.vo.a3;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@ApiModel("个性化资源生成方案")
public class A3ResourcePlanVO {

    @ApiModelProperty("资源策略摘要")
    private String strategySummary;

    @ApiModelProperty("生成进度提示")
    private String progressMessage;

    @ApiModelProperty("资源卡片列表")
    private List<A3ResourceCardVO> resourceCards;
}
