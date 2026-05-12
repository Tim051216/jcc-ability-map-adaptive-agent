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
import java.time.LocalDateTime;
import java.util.List;

/**
 * <p>
 * 测评表 - 存储测评基本信息
 * </p>
 *
 * @author A3 Team
 * @since 2026-05-09
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName(value = "evaluation_test", autoResultMap = true)
@ApiModel(value = "EvaluationTest对象", description = "测评表")
public class EvaluationTest implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "测评ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "测评标题")
    private String title;

    @ApiModelProperty(value = "测评描述")
    private String description;

    @ApiModelProperty(value = "测评类型: 1-课前测评, 2-课中练习, 3-课后测评, 4-阶段测试")
    private Integer testType;

    @ApiModelProperty(value = "难度层级: 1-基础, 2-进阶, 3-拔高")
    private Integer difficultyLevel;

    @ApiModelProperty(value = "关联课程ID")
    private Long courseId;

    @ApiModelProperty(value = "关联章节ID")
    private Long chapterId;

    @ApiModelProperty(value = "关联小节ID")
    private Long sectionId;

    @ApiModelProperty(value = "关联知识点列表")
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> knowledgePoints;

    @ApiModelProperty(value = "总分")
    private Integer totalScore;

    @ApiModelProperty(value = "及格分")
    private Integer passScore;

    @ApiModelProperty(value = "时间限制(分钟), NULL表示不限时")
    private Integer timeLimit;

    @ApiModelProperty(value = "题目数量")
    private Integer questionCount;

    @ApiModelProperty(value = "状态: 0-草稿, 1-已发布, 2-已关闭")
    private Integer status;

    @ApiModelProperty(value = "创建者ID")
    private Long creatorId;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
