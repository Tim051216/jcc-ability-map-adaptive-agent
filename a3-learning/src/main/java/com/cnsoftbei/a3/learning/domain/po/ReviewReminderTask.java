package com.cnsoftbei.a3.learning.domain.po;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.Accessors;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("review_reminder_task")
@ApiModel(value = "ReviewReminderTask对象", description = "智能复习提醒任务")
public class ReviewReminderTask implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.ASSIGN_ID)
    @ApiModelProperty("任务ID")
    private Long id;

    @ApiModelProperty("用户ID")
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

    @ApiModelProperty("任务状态")
    private String status;

    @ApiModelProperty("渠道策略")
    private String channelStrategy;

    @ApiModelProperty("失败原因")
    private String failReason;

    @ApiModelProperty("扩展数据")
    private String extraJson;

    @ApiModelProperty("创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty("更新时间")
    private LocalDateTime updateTime;
}
