package com.cnsoftbei.a3.learning.domain.dto;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import javax.validation.constraints.NotNull;
import java.util.Map;

/**
 * 学习行为数据传输对象
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@ApiModel(description = "学习行为数据")
public class LearningBehaviorDTO {

    @ApiModelProperty("行为类型：1-答题，2-资源浏览，3-路径完成，4-互动问答")
    @NotNull(message = "行为类型不能为空")
    private Integer behaviorType;

    @ApiModelProperty("行为详细数据")
    @NotNull(message = "行为数据不能为空")
    private Map<String, Object> behaviorData;

    @ApiModelProperty("资源类型：course-课程，section-小节，question-题目")
    private String resourceType;

    @ApiModelProperty("资源ID")
    private Long resourceId;

    @ApiModelProperty("行为结果：correct-正确，wrong-错误，completed-完成，abandoned-放弃")
    private String result;

    @ApiModelProperty("行为时长（秒）")
    private Integer duration;
}
