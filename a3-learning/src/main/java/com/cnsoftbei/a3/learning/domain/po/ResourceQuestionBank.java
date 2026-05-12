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
 * 题库资源详情表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("resource_question_bank")
@ApiModel(value = "ResourceQuestionBank对象", description = "题库资源详情表")
public class ResourceQuestionBank implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "题库ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "资源ID")
    private Long resourceId;

    @ApiModelProperty(value = "题库标题")
    private String title;

    @ApiModelProperty(value = "题目总数")
    private Integer totalQuestions;

    @ApiModelProperty(value = "基础层题目数")
    private Integer basicQuestions;

    @ApiModelProperty(value = "进阶层题目数")
    private Integer advancedQuestions;

    @ApiModelProperty(value = "拔高层题目数")
    private Integer expertQuestions;

    @ApiModelProperty(value = "题型分布（JSON格式）")
    private String questionTypes;

    @ApiModelProperty(value = "知识点覆盖（JSON格式）")
    private String knowledgeCoverage;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
