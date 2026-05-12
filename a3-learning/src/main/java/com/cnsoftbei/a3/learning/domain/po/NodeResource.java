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
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * <p>
 * 节点资源关联表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName(value = "node_resource", autoResultMap = true)
@ApiModel(value = "NodeResource对象", description = "节点资源关联表")
public class NodeResource implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "关联ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "节点ID")
    private Long nodeId;

    @ApiModelProperty(value = "路径ID")
    private Long pathId;

    @ApiModelProperty(value = "用户ID")
    private Long userId;

    @ApiModelProperty(value = "资源类型：video-视频，document-文档，exercise-练习，test-测试，article-文章")
    private String resourceType;

    @ApiModelProperty(value = "资源ID")
    private Long resourceId;

    @ApiModelProperty(value = "资源名称")
    private String resourceName;

    @ApiModelProperty(value = "资源URL")
    private String resourceUrl;

    @ApiModelProperty(value = "是否必需完成")
    private Boolean isRequired;

    @ApiModelProperty(value = "资源顺序")
    private Integer resourceOrder;

    @ApiModelProperty(value = "预估学习时长（分钟）")
    private Integer estimatedDuration;

    @ApiModelProperty(value = "推送状态：0-未推送，1-已推送，2-已查看，3-已完成")
    private Integer pushStatus;

    @ApiModelProperty(value = "推送时间")
    private LocalDateTime pushTime;

    @ApiModelProperty(value = "查看时间")
    private LocalDateTime viewTime;

    @ApiModelProperty(value = "完成时间")
    private LocalDateTime completeTime;

    @ApiModelProperty(value = "完成百分比(0-100)")
    private Integer progressPercentage;

    @ApiModelProperty(value = "实际学习时长（分钟）")
    private Integer actualDuration;

    @ApiModelProperty(value = "得分（如练习、测试的分数）")
    private BigDecimal score;

    @ApiModelProperty(value = "通过状态：0-未通过，1-已通过")
    private Integer passStatus;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
