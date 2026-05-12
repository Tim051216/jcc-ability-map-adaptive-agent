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
 * 画像历史版本表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName(value = "profile_history", autoResultMap = true)
@ApiModel(value = "ProfileHistory对象", description = "画像历史版本表")
public class ProfileHistory implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "历史记录ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "画像ID")
    private Long profileId;

    @ApiModelProperty(value = "学生用户ID")
    private Long userId;

    @ApiModelProperty(value = "版本号")
    private Integer version;

    @ApiModelProperty(value = "画像快照数据（完整六维度）")
    private String snapshotData;

    @ApiModelProperty(value = "变更类型：1-初始创建，2-对话更新，3-行为更新，4-手动调整")
    private Integer changeType;

    @ApiModelProperty(value = "变更描述")
    private String changeDescription;

    @ApiModelProperty(value = "变更的维度，逗号分隔")
    private String changedDimensions;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;
}
