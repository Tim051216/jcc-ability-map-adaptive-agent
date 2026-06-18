package com.cnsoftbei.a3.learning.domain.dto;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
@ApiModel(description = "复习提醒失败回写表单")
public class ReviewReminderFailDTO {

    @ApiModelProperty("失败原因")
    private String failReason;
}
