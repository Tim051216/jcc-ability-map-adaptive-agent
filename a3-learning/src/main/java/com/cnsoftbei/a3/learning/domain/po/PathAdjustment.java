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
 * 路径调整记录表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName(value = "path_adjustment", autoResultMap = true)
@ApiModel(value = "PathAdjustment对象", description = "路径调整记录表")
public class PathAdjustment implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "调整记录ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "路径ID")
    private Long pathId;

    @ApiModelProperty(value = "用户ID")
    private Long userId;

    @ApiModelProperty(value = "调整类型：1-自动优化，2-手动调整，3-难度调整，4-节点增删")
    private Integer adjustmentType;

    @ApiModelProperty(value = "触发原因")
    private String triggerReason;

    @ApiModelProperty(value = "调整详细数据（JSON格式）")
    private String adjustmentData;

    @ApiModelProperty(value = "受影响的节点ID列表（JSON格式）")
    private String affectedNodes;

    @ApiModelProperty(value = "调整前快照（JSON格式）")
    private String beforeSnapshot;

    @ApiModelProperty(value = "调整后快照（JSON格式）")
    private String afterSnapshot;

    @ApiModelProperty(value = "调整状态：0-待确认，1-已应用，2-已拒绝")
    private Integer status;

    @ApiModelProperty(value = "应用时间")
    private LocalDateTime applyTime;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;
}
