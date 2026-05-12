package com.cnsoftbei.a3.learning.domain.vo;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.util.List;

/**
 * 路径维度进度汇总
 */
@Data
@ApiModel(value = "路径进度VO")
public class PathProgressVO {

    @ApiModelProperty("路径ID")
    private Long pathId;

    @ApiModelProperty("路径名称")
    private String pathName;

    @ApiModelProperty("整体完成百分比")
    private Integer progressPercentage;

    @ApiModelProperty("已完成节点数")
    private Integer completedNodes;

    @ApiModelProperty("总节点数")
    private Integer totalNodes;

    @ApiModelProperty("当前节点ID")
    private Long currentNodeId;

    @ApiModelProperty("节点进度明细")
    private List<PathNodeVO> nodes;
}
