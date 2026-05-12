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
 * 对话会话表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("conversation_session")
@ApiModel(value = "ConversationSession对象", description = "对话会话表")
public class ConversationSession implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "会话ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "学生用户ID")
    private Long userId;

    @ApiModelProperty(value = "关联的画像ID")
    private Long profileId;

    @ApiModelProperty(value = "会话状态：0-进行中，1-已完成，2-已中断")
    private Integer status;

    @ApiModelProperty(value = "会话类型：1-初始画像构建，2-画像补充，3-画像验证")
    private Integer sessionType;

    @ApiModelProperty(value = "总对话轮次")
    private Integer totalRounds;

    @ApiModelProperty(value = "已采集的维度，逗号分隔")
    private String collectedDimensions;

    @ApiModelProperty(value = "信息采集完整度(0-100)")
    private Integer completeness;

    @ApiModelProperty(value = "开始时间")
    private LocalDateTime startTime;

    @ApiModelProperty(value = "结束时间")
    private LocalDateTime endTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
