package com.cnsoftbei.a3.learning.domain.dto;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

/**
 * 对话消息传输对象
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@ApiModel(description = "对话消息")
public class ConversationMessageDTO {

    @ApiModelProperty("会话ID")
    @NotNull(message = "会话ID不能为空")
    private Long sessionId;

    @ApiModelProperty("消息内容")
    @NotBlank(message = "消息内容不能为空")
    private String content;

    @ApiModelProperty("消息类型：1-普通对话，2-引导问题，3-确认信息")
    private Integer messageType;
}
