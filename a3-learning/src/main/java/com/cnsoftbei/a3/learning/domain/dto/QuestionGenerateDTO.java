package com.cnsoftbei.a3.learning.domain.dto;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import javax.validation.constraints.NotNull;
import java.util.List;

/**
 * 题目生成请求 DTO
 *
 * @author A3 Team
 * @since 2026-05-09
 */
@Data
@ApiModel(value = "题目生成DTO", description = "AI题目生成请求数据传输对象")
public class QuestionGenerateDTO {

    @ApiModelProperty(value = "测评ID", required = true)
    @NotNull(message = "测评ID不能为空")
    private Long testId;

    @ApiModelProperty(value = "知识点列表", required = true)
    @NotNull(message = "知识点列表不能为空")
    private List<String> knowledgePoints;

    @ApiModelProperty(value = "难度层级: 1-基础, 2-进阶, 3-拔高")
    private Integer difficultyLevel;

    @ApiModelProperty(value = "题目类型: 1-单选, 2-多选, 3-判断, 4-填空, 5-简答, 6-编程")
    private Integer questionType;

    @ApiModelProperty(value = "生成数量")
    private Integer count;

    @ApiModelProperty(value = "是否生成分层题目 (基础+进阶+拔高)")
    private Boolean generateLayered;

    @ApiModelProperty(value = "课程上下文信息")
    private String courseContext;
}
