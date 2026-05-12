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
 * 测评记录表 - 存储学生整体测评记录
 * </p>
 *
 * @author A3 Team
 * @since 2026-05-09
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName(value = "evaluation_test_record", autoResultMap = true)
@ApiModel(value = "EvaluationTestRecord对象", description = "测评记录表")
public class EvaluationTestRecord implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "测评记录ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "测评ID")
    private Long testId;

    @ApiModelProperty(value = "学生ID")
    private Long userId;

    @ApiModelProperty(value = "总得分")
    private BigDecimal totalScore;

    @ApiModelProperty(value = "总题数")
    private Integer totalQuestions;

    @ApiModelProperty(value = "正确题数")
    private Integer correctCount;

    @ApiModelProperty(value = "错误题数")
    private Integer wrongCount;

    @ApiModelProperty(value = "未答题数")
    private Integer unansweredCount;

    @ApiModelProperty(value = "完成率(%)")
    private BigDecimal completionRate;

    @ApiModelProperty(value = "正确率(%)")
    private BigDecimal accuracyRate;

    @ApiModelProperty(value = "总用时(秒)")
    private Integer timeSpent;

    @ApiModelProperty(value = "状态: 0-进行中, 1-已提交, 2-已批改")
    private Integer status;

    @ApiModelProperty(value = "开始时间")
    private LocalDateTime startTime;

    @ApiModelProperty(value = "提交时间")
    private LocalDateTime submitTime;

    @ApiModelProperty(value = "批改完成时间")
    private LocalDateTime gradingCompleteTime;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
