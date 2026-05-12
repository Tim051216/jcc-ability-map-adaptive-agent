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
 * 错题本表 - 记录学生的错题
 * </p>
 *
 * @author A3 Team
 * @since 2026-05-09
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName(value = "evaluation_wrong_question", autoResultMap = true)
@ApiModel(value = "EvaluationWrongQuestion对象", description = "错题本表")
public class EvaluationWrongQuestion implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "记录ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "学生ID")
    private Long userId;

    @ApiModelProperty(value = "题目ID")
    private Long questionId;

    @ApiModelProperty(value = "测评ID")
    private Long testId;

    @ApiModelProperty(value = "答题记录ID")
    private Long answerRecordId;

    @ApiModelProperty(value = "知识点")
    private String knowledgePoint;

    @ApiModelProperty(value = "错误次数")
    private Integer wrongCount;

    @ApiModelProperty(value = "是否已掌握: 0-未掌握, 1-已掌握")
    private Integer isMastered;

    @ApiModelProperty(value = "最后错误时间")
    private LocalDateTime lastWrongTime;

    @ApiModelProperty(value = "掌握时间")
    private LocalDateTime masteredTime;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
