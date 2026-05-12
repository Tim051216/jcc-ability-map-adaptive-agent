package com.cnsoftbei.a3.learning.domain.po;

import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.Accessors;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * <p>
 * 路径节点表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName(value = "path_node", autoResultMap = true)
@ApiModel(value = "PathNode对象", description = "路径节点表")
public class PathNode implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "节点ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "所属路径ID")
    private Long pathId;

    @ApiModelProperty(value = "学生用户ID")
    private Long userId;

    @ApiModelProperty(value = "节点名称")
    private String nodeName;

    @ApiModelProperty(value = "节点描述")
    private String nodeDesc;

    @ApiModelProperty(value = "节点顺序（从1开始）")
    private Integer nodeOrder;

    @ApiModelProperty(value = "节点类型：1-学习节点，2-练习节点，3-测评节点，4-复习节点")
    private Integer nodeType;

    @ApiModelProperty(value = "阶段类型：1-基础阶段，2-进阶阶段，3-高级阶段，4-综合阶段")
    private Integer stageType;

    @ApiModelProperty(value = "关联的知识点列表（JSON格式）")
    private String knowledgePoints;

    @ApiModelProperty(value = "前置节点ID列表（JSON格式）")
    private String prerequisiteNodes;

    @ApiModelProperty(value = "难度等级：1-入门，2-初级，3-中级，4-高级，5-专家")
    private Integer difficultyLevel;

    @ApiModelProperty(value = "完成条件配置（JSON格式）")
    private String completionCriteria;

    @ApiModelProperty(value = "预估学习时长（分钟）")
    private Integer estimatedDuration;

    @ApiModelProperty(value = "节点状态：0-未开始，1-进行中，2-已完成，3-已跳过，4-已暂缓")
    private Integer status;

    @ApiModelProperty(value = "是否锁定（需完成前置节点才能解锁）")
    private Boolean isLocked;

    @ApiModelProperty(value = "完成百分比(0-100)")
    private Integer progressPercentage;

    @ApiModelProperty(value = "实际学习时长（分钟）")
    private Integer actualDuration;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty(value = "解锁时间")
    private LocalDateTime unlockTime;

    @ApiModelProperty(value = "开始时间")
    private LocalDateTime startTime;

    @ApiModelProperty(value = "完成时间")
    private LocalDateTime completeTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
