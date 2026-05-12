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
 * 评估报告表 - 存储多维度学习效果评估报告
 * </p>
 *
 * @author A3 Team
 * @since 2026-05-09
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName(value = "evaluation_report", autoResultMap = true)
@ApiModel(value = "EvaluationReport对象", description = "评估报告表")
public class EvaluationReport implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "报告ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "学生ID")
    private Long userId;

    @ApiModelProperty(value = "课程ID")
    private Long courseId;

    @ApiModelProperty(value = "报告类型: 1-单次测评报告, 2-阶段性报告, 3-综合报告")
    private Integer reportType;

    @ApiModelProperty(value = "统计时间范围-开始")
    private LocalDateTime timeRangeStart;

    @ApiModelProperty(value = "统计时间范围-结束")
    private LocalDateTime timeRangeEnd;

    @ApiModelProperty(value = "关联的测评ID列表")
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<Long> testIds;

    @ApiModelProperty(value = "综合得分")
    private BigDecimal overallScore;

    @ApiModelProperty(value = "知识点掌握度分析(JSON格式)")
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> knowledgeMastery;

    @ApiModelProperty(value = "能力维度分析(JSON格式)")
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> abilityAnalysis;

    @ApiModelProperty(value = "学习效率分析(JSON格式)")
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> learningEfficiency;

    @ApiModelProperty(value = "优势分析")
    private String strengths;

    @ApiModelProperty(value = "薄弱点分析")
    private String weaknesses;

    @ApiModelProperty(value = "改进建议")
    private String improvementSuggestions;

    @ApiModelProperty(value = "推荐学习资源")
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<Map<String, Object>> recommendedResources;

    @ApiModelProperty(value = "报告生成模型标识")
    private String generationModel;

    @ApiModelProperty(value = "状态: 0-生成中, 1-已完成")
    private Integer status;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
