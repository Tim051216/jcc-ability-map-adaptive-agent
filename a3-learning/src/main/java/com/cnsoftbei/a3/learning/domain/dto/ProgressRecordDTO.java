package com.cnsoftbei.a3.learning.domain.dto;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import javax.validation.constraints.NotNull;

/**
 * 学习进度上报
 */
@Data
@ApiModel(value = "进度记录DTO")
public class ProgressRecordDTO {

    @ApiModelProperty(value = "路径ID", required = true)
    @NotNull(message = "路径ID不能为空")
    private Long pathId;

    @ApiModelProperty(value = "节点ID", required = true)
    @NotNull(message = "节点ID不能为空")
    private Long nodeId;

    @ApiModelProperty("已废弃：始终以登录上下文用户为准")
    @Deprecated
    private Long userId;

    @ApiModelProperty(value = "进度类型：1-节点开始，2-资源学习，3-节点完成，4-暂缓，5-跳过", required = true)
    @NotNull(message = "进度类型不能为空")
    private Integer progressType;

    @ApiModelProperty("进度详细数据 JSON")
    private String progressData;

    @ApiModelProperty("进度百分比 0-100")
    private Integer progressPercentage;

    @ApiModelProperty("本次学习时长（秒）")
    private Integer duration;

    @ApiModelProperty("学习结果 JSON")
    private String resultData;
}
