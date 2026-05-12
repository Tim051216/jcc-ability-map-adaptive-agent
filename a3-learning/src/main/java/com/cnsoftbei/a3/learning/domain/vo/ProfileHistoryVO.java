package com.cnsoftbei.a3.learning.domain.vo;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 画像历史版本视图对象
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@ApiModel(description = "画像历史版本")
public class ProfileHistoryVO {

    @ApiModelProperty("历史记录ID")
    private Long id;

    @ApiModelProperty("画像ID")
    private Long profileId;

    @ApiModelProperty("版本号")
    private Integer version;

    @ApiModelProperty("变更类型：1-初始创建，2-对话更新，3-行为更新，4-手动调整")
    private Integer changeType;

    @ApiModelProperty("变更描述")
    private String changeDescription;

    @ApiModelProperty("变更的维度列表")
    private List<String> changedDimensions;

    @ApiModelProperty("创建时间")
    private LocalDateTime createTime;
}
