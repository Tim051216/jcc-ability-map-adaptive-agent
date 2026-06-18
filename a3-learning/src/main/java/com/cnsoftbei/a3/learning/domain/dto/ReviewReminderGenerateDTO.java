package com.cnsoftbei.a3.learning.domain.dto;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@ApiModel(description = "复习提醒任务生成表单")
public class ReviewReminderGenerateDTO {

    @ApiModelProperty("用户ID，默认当前用户")
    private Long userId;

    @ApiModelProperty("课程ID")
    private Long courseId;

    @ApiModelProperty("课时ID")
    private Long lessonId;

    @ApiModelProperty("资源ID")
    private Long resourceId;

    @ApiModelProperty("触发类型")
    private String triggerType;

    @ApiModelProperty("提醒标题")
    private String title;

    @ApiModelProperty("提醒内容")
    private String content;

    @ApiModelProperty("建议回顾的视频/资料名称")
    private String sourceVideo;

    @ApiModelProperty("提醒时间")
    private LocalDateTime remindAt;

    @ApiModelProperty("渠道策略，逗号分隔")
    private String channelStrategy;

    @ApiModelProperty("扩展数据")
    private String extraJson;
}
