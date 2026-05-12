package com.cnsoftbei.a3.learning.domain.vo;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 对话消息视图对象
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@ApiModel(description = "对话消息")
public class ConversationMessageVO {

    @ApiModelProperty("消息ID")
    private Long id;

    @ApiModelProperty("会话ID")
    private Long sessionId;

    @ApiModelProperty("角色：user-用户，assistant-助手，system-系统")
    private String role;

    @ApiModelProperty("消息内容")
    private String content;

    @ApiModelProperty("对话轮次")
    private Integer roundNumber;

    @ApiModelProperty("消息类型：1-普通对话，2-引导问题，3-确认信息")
    private Integer messageType;

    @ApiModelProperty("相关维度")
    private String relatedDimension;

    @ApiModelProperty("创建时间")
    private LocalDateTime createTime;
}
