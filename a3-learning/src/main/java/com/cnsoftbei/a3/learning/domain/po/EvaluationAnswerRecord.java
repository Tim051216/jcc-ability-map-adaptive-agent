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
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * <p>
 * 答题记录表 - 存储学生答题详情
 * </p>
 *
 * @author A3 Team
 * @since 2026-05-09
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName(value = "evaluation_answer_record", autoResultMap = true)
@ApiModel(value = "EvaluationAnswerRecord对象", description = "答题记录表")
public class EvaluationAnswerRecord implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "答题记录ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "测评ID")
    private Long testId;

    @ApiModelProperty(value = "题目ID")
    private Long questionId;

    @ApiModelProperty(value = "学生ID")
    private Long userId;

    @ApiModelProperty(value = "学生答案")
    private String userAnswer;

    @ApiModelProperty(value = "是否正确: 0-错误, 1-正确, NULL-待批改")
    private Integer isCorrect;

    @ApiModelProperty(value = "得分")
    private BigDecimal score;

    @ApiModelProperty(value = "批改类型: 1-自动批改, 2-AI批改, 3-人工批改")
    private Integer gradingType;

    @ApiModelProperty(value = "批改反馈")
    private String gradingFeedback;

    @ApiModelProperty(value = "批改模型标识(AI批改时)")
    private String gradingModel;

    @ApiModelProperty(value = "答题用时(秒)")
    private Integer answerTime;

    @ApiModelProperty(value = "提交时间")
    private LocalDateTime submitTime;

    @ApiModelProperty(value = "批改时间")
    private LocalDateTime gradingTime;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
