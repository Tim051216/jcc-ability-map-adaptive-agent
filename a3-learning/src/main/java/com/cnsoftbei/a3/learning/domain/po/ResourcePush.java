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
 * 资源推送记录表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName(value = "resource_push", autoResultMap = true)
@ApiModel(value = "ResourcePush对象", description = "资源推送记录表")
public class ResourcePush implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "推送记录ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "路径ID")
    private Long pathId;

    @ApiModelProperty(value = "节点ID")
    private Long nodeId;

    @ApiModelProperty(value = "用户ID")
    private Long userId;

    @ApiModelProperty(value = "推送类型：1-节点激活推送，2-资源推送，3-提醒推送")
    private Integer pushType;

    @ApiModelProperty(value = "推送标题")
    private String pushTitle;

    @ApiModelProperty(value = "推送内容")
    private String pushContent;

    @ApiModelProperty(value = "推送数据（JSON格式）")
    private String pushData;

    @ApiModelProperty(value = "推送渠道：system-系统消息，email-邮件，sms-短信")
    private String pushChannel;

    @ApiModelProperty(value = "推送状态：0-待推送，1-已推送，2-已读，3-已处理")
    private Integer pushStatus;

    @ApiModelProperty(value = "推送时间")
    private LocalDateTime pushTime;

    @ApiModelProperty(value = "阅读时间")
    private LocalDateTime readTime;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;
}
