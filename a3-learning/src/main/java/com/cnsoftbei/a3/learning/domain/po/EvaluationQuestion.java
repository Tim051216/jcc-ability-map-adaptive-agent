package com.cnsoftbei.a3.learning.domain.po;

import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.Accessors;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * <p>
 * 测评题目表 - 存储AI生成的测评题目
 * </p>
 *
 * @author A3 Team
 * @since 2026-05-09
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName(value = "evaluation_question", autoResultMap = true)
@ApiModel(value = "EvaluationQuestion对象", description = "测评题目表")
public class EvaluationQuestion implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "题目ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "所属测评ID")
    private Long testId;

    @ApiModelProperty(value = "题目类型: 1-单选, 2-多选, 3-判断, 4-填空, 5-简答, 6-编程")
    private Integer questionType;

    @ApiModelProperty(value = "难度层级: 1-基础, 2-进阶, 3-拔高")
    private Integer difficultyLevel;

    @ApiModelProperty(value = "关联知识点")
    private String knowledgePoint;

    @ApiModelProperty(value = "题目内容")
    private String questionContent;

    @ApiModelProperty(value = "选项内容(JSON格式), 适用于选择题和判断题")
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<Map<String, Object>> questionOptions;

    @ApiModelProperty(value = "正确答案")
    private String correctAnswer;

    @ApiModelProperty(value = "答案解析")
    private String answerAnalysis;

    @ApiModelProperty(value = "题目分值")
    private BigDecimal score;

    @ApiModelProperty(value = "题目顺序")
    private Integer orderNum;

    @ApiModelProperty(value = "AI生成时使用的提示词")
    private String generationPrompt;

    @ApiModelProperty(value = "生成模型标识")
    private String generationModel;

    @ApiModelProperty(value = "题目质量评分(0-1)")
    private BigDecimal qualityScore;

    @ApiModelProperty(value = "状态: 0-草稿, 1-已发布, 2-已废弃")
    private Integer status;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
