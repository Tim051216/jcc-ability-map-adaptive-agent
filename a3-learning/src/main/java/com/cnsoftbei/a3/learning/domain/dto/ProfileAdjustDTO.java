package com.cnsoftbei.a3.learning.domain.dto;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.util.Map;

/**
 * 画像手动调整传输对象
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@ApiModel(description = "画像手动调整数据")
public class ProfileAdjustDTO {

    @ApiModelProperty("维度代码")
    @NotBlank(message = "维度代码不能为空")
    private String dimensionCode;

    @ApiModelProperty("调整的数据")
    @NotNull(message = "调整数据不能为空")
    private Map<String, Object> adjustData;

    @ApiModelProperty("调整原因")
    private String reason;
}
