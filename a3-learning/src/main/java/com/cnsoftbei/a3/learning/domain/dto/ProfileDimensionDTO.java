package com.cnsoftbei.a3.learning.domain.dto;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.util.Map;

/**
 * 画像维度数据传输对象
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@ApiModel(description = "画像维度数据")
public class ProfileDimensionDTO {

    @ApiModelProperty("维度代码")
    private String dimensionCode;

    @ApiModelProperty("维度名称")
    private String dimensionName;

    @ApiModelProperty("维度数据（键值对）")
    private Map<String, Object> data;

    @ApiModelProperty("维度完整度(0-100)")
    private Integer completeness;

    @ApiModelProperty("维度权重")
    private Double weight;
}
