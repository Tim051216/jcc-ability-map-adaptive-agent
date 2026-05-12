package com.cnsoftbei.a3.learning.domain.vo;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 路径节点详情
 */
@Data
@ApiModel(value = "路径节点VO")
public class PathNodeVO {

    @ApiModelProperty("节点ID")
    private Long id;

    @ApiModelProperty("所属路径ID")
    private Long pathId;

    @ApiModelProperty("学生用户ID")
    private Long userId;

    @ApiModelProperty("节点名称")
    private String nodeName;

    @ApiModelProperty("节点描述")
    private String nodeDesc;

    @ApiModelProperty("顺序")
    private Integer nodeOrder;

    @ApiModelProperty("节点类型")
    private Integer nodeType;

    @ApiModelProperty("阶段类型")
    private Integer stageType;

    @ApiModelProperty("知识点 JSON 字符串")
    private String knowledgePoints;

    @ApiModelProperty("前置节点 JSON")
    private String prerequisiteNodes;

    @ApiModelProperty("难度")
    private Integer difficultyLevel;

    @ApiModelProperty("完成条件 JSON")
    private String completionCriteria;

    @ApiModelProperty("预估时长（分钟）")
    private Integer estimatedDuration;

    @ApiModelProperty("节点状态")
    private Integer status;

    @ApiModelProperty("是否锁定")
    private Boolean isLocked;

    @ApiModelProperty("完成百分比")
    private Integer progressPercentage;

    @ApiModelProperty("实际时长（分钟）")
    private Integer actualDuration;

    @ApiModelProperty("创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty("解锁时间")
    private LocalDateTime unlockTime;

    @ApiModelProperty("开始时间")
    private LocalDateTime startTime;

    @ApiModelProperty("完成时间")
    private LocalDateTime completeTime;

    @ApiModelProperty("更新时间")
    private LocalDateTime updateTime;

    @ApiModelProperty("节点配套资源")
    private List<NodeResourceVO> resources;
}
