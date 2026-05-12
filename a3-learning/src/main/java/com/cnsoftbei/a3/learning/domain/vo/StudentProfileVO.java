package com.cnsoftbei.a3.learning.domain.vo;

import com.cnsoftbei.a3.learning.domain.dto.ProfileDimensionDTO;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 学生画像视图对象
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@ApiModel(description = "学生画像详情")
public class StudentProfileVO {

    @ApiModelProperty("画像ID")
    private Long id;

    @ApiModelProperty("学生用户ID")
    private Long userId;

    @ApiModelProperty("画像版本号")
    private Integer version;

    @ApiModelProperty("六维度画像数据")
    private List<ProfileDimensionDTO> dimensions;

    @ApiModelProperty("学习标签列表")
    private List<String> tags;

    @ApiModelProperty("画像完整度百分比(0-100)")
    private Integer completeness;

    @ApiModelProperty("画像状态：0-未激活，1-正常，2-已过期")
    private Integer status;

    @ApiModelProperty("创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty("更新时间")
    private LocalDateTime updateTime;

    @ApiModelProperty("最后学习行为时间")
    private LocalDateTime lastBehaviorTime;
}
