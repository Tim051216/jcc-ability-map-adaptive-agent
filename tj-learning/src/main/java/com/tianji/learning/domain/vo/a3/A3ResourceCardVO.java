package com.tianji.learning.domain.vo.a3;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@ApiModel("个性化资源卡片")
public class A3ResourceCardVO {

    @ApiModelProperty("资源类型")
    private String type;

    @ApiModelProperty("资源标题")
    private String title;

    @ApiModelProperty("资源摘要")
    private String summary;

    @ApiModelProperty("展示形式")
    private String format;

    @ApiModelProperty("负责智能体")
    private String agentRole;
}
