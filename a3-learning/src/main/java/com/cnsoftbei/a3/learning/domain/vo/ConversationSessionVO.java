package com.cnsoftbei.a3.learning.domain.vo;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 对话会话视图对象
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@ApiModel(description = "对话会话信息")
public class ConversationSessionVO {

    @ApiModelProperty("会话ID")
    private Long id;

    @ApiModelProperty("学生用户ID")
    private Long userId;

    @ApiModelProperty("关联的画像ID")
    private Long profileId;

    @ApiModelProperty("会话状态：0-进行中，1-已完成，2-已中断")
    private Integer status;

    @ApiModelProperty("会话类型：1-初始画像构建，2-画像补充，3-画像验证")
    private Integer sessionType;

    @ApiModelProperty("总对话轮次")
    private Integer totalRounds;

    @ApiModelProperty("已采集的维度列表")
    private List<String> collectedDimensions;

    @ApiModelProperty("信息采集完整度(0-100)")
    private Integer completeness;

    @ApiModelProperty("开始时间")
    private LocalDateTime startTime;

    @ApiModelProperty("结束时间")
    private LocalDateTime endTime;

    @ApiModelProperty("对话消息列表")
    private List<ConversationMessageVO> messages;
}
