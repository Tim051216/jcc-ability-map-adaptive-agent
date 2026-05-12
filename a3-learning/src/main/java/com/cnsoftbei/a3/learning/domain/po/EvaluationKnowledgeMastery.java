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
 * 知识点掌握度表 - 记录学生对各知识点的掌握情况
 * </p>
 *
 * @author A3 Team
 * @since 2026-05-09
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName(value = "evaluation_knowledge_mastery", autoResultMap = true)
@ApiModel(value = "EvaluationKnowledgeMastery对象", description = "知识点掌握度表")
public class EvaluationKnowledgeMastery implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "记录ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "学生ID")
    private Long userId;

    @ApiModelProperty(value = "课程ID")
    private Long courseId;

    @ApiModelProperty(value = "知识点")
    private String knowledgePoint;

    @ApiModelProperty(value = "掌握程度: 0-未学习, 1-初步了解, 2-基本掌握, 3-熟练掌握, 4-精通")
    private Integer masteryLevel;

    @ApiModelProperty(value = "掌握度分数(0-100)")
    private BigDecimal masteryScore;

    @ApiModelProperty(value = "练习次数")
    private Integer practiceCount;

    @ApiModelProperty(value = "正确次数")
    private Integer correctCount;

    @ApiModelProperty(value = "正确率(%)")
    private BigDecimal accuracyRate;

    @ApiModelProperty(value = "最后练习时间")
    private LocalDateTime lastPracticeTime;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
