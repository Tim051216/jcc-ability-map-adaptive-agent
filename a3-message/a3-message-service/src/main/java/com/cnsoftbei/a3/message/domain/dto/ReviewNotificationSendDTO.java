package com.cnsoftbei.a3.message.domain.dto;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
@ApiModel(description = "复习提醒发送表单")
public class ReviewNotificationSendDTO {

    @ApiModelProperty("提醒任务ID")
    private Long taskId;

    @ApiModelProperty("用户ID")
    private Long userId;

    @ApiModelProperty("提醒标题")
    private String title;

    @ApiModelProperty("提醒内容")
    private String content;

    @ApiModelProperty("渠道策略，逗号分隔")
    private String channelStrategy;
}
