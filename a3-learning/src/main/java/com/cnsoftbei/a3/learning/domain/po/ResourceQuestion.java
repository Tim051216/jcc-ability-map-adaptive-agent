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
 * 题目详情表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("resource_question")
@ApiModel(value = "ResourceQuestion对象", description = "题目详情表")
public class ResourceQuestion implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "题目ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "题库ID")
    private Long questionBankId;

    @ApiModelProperty(value = "题型：1-单选，2-多选，3-判断，4-填空，5-简答，6-编程")
    private Integer questionType;

    @ApiModelProperty(value = "难度层级：1-基础，2-进阶，3-拔高")
    private Integer difficultyLevel;

    @ApiModelProperty(value = "题目内容")
    private String questionContent;

    @ApiModelProperty(value = "选项（JSON格式，适用于选择题）")
    private String options;

    @ApiModelProperty(value = "正确答案")
    private String correctAnswer;

    @ApiModelProperty(value = "答案解析")
    private String answerAnalysis;

    @ApiModelProperty(value = "关联知识点（逗号分隔）")
    private String knowledgePoints;

    @ApiModelProperty(value = "分值")
    private BigDecimal score;

    @ApiModelProperty(value = "排序号")
    private Integer orderNum;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
