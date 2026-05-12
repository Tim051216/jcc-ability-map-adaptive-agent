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
 * 学习行为数据表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName(value = "learning_behavior", autoResultMap = true)
@ApiModel(value = "LearningBehavior对象", description = "学习行为数据表")
public class LearningBehavior implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "行为ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "用户ID")
    private Long userId;

    @ApiModelProperty(value = "画像ID")
    private Long profileId;

    @ApiModelProperty(value = "行为类型：1-答题，2-资源浏览，3-路径完成，4-互动问答")
    private Integer behaviorType;

    @ApiModelProperty(value = "行为详细数据")
    private String behaviorData;

    @ApiModelProperty(value = "资源类型：course-课程，section-小节，question-题目")
    private String resourceType;

    @ApiModelProperty(value = "资源ID")
    private Long resourceId;

    @ApiModelProperty(value = "行为结果：correct-正确，wrong-错误，completed-完成，abandoned-放弃")
    private String result;

    @ApiModelProperty(value = "行为时长（秒）")
    private Integer duration;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;
}
