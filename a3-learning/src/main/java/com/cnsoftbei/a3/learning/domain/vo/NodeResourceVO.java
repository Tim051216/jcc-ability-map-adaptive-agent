package com.cnsoftbei.a3.learning.domain.vo;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

/**
 * 路径节点关联的学习资源（展示用）
 */
@Data
@ApiModel(value = "节点资源VO")
public class NodeResourceVO {

    @ApiModelProperty("关联ID")
    private Long id;

    @ApiModelProperty("节点ID")
    private Long nodeId;

    @ApiModelProperty("资源类型")
    private String resourceType;

    @ApiModelProperty("资源ID")
    private Long resourceId;

    @ApiModelProperty("资源名称")
    private String resourceName;

    @ApiModelProperty("资源链接")
    private String resourceUrl;

    @ApiModelProperty("预估学习时长（分钟）")
    private Integer estimatedDuration;

    @ApiModelProperty("推送状态")
    private Integer pushStatus;
}
