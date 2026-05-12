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
 * 对话消息表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("conversation_message")
@ApiModel(value = "ConversationMessage对象", description = "对话消息表")
public class ConversationMessage implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "消息ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "会话ID")
    private Long sessionId;

    @ApiModelProperty(value = "用户ID")
    private Long userId;

    @ApiModelProperty(value = "角色：user-用户，assistant-助手，system-系统")
    private String role;

    @ApiModelProperty(value = "消息内容")
    private String content;

    @ApiModelProperty(value = "对话轮次")
    private Integer roundNumber;

    @ApiModelProperty(value = "消息类型：1-普通对话，2-引导问题，3-确认信息")
    private Integer messageType;

    @ApiModelProperty(value = "相关维度")
    private String relatedDimension;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;
}
