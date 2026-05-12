package com.cnsoftbei.a3.learning.domain.dto;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import javax.validation.constraints.NotNull;
import java.util.Map;

/**
 * 答题提交 DTO
 *
 * @author A3 Team
 * @since 2026-05-09
 */
@Data
@ApiModel(value = "答题提交DTO", description = "学生答题提交数据传输对象")
public class AnswerSubmitDTO {

    @ApiModelProperty(value = "测评ID", required = true)
    @NotNull(message = "测评ID不能为空")
    private Long testId;

    @ApiModelProperty(value = "答案Map (题目ID -> 学生答案)", required = true)
    @NotNull(message = "答案不能为空")
    private Map<Long, String> answers;

    @ApiModelProperty(value = "总用时(秒)")
    private Integer timeSpent;
}
