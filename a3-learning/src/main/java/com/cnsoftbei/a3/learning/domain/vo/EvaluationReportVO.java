package com.cnsoftbei.a3.learning.domain.vo;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 评估报告 VO
 *
 * @author A3 Team
 * @since 2026-05-09
 */
@Data
@ApiModel(value = "评估报告VO", description = "评估报告视图对象")
public class EvaluationReportVO {

    @ApiModelProperty(value = "报告ID")
    private Long id;

    @ApiModelProperty(value = "学生ID")
    private Long userId;

    @ApiModelProperty(value = "课程ID")
    private Long courseId;

    @ApiModelProperty(value = "报告类型: 1-单次测评报告, 2-阶段性报告, 3-综合报告")
    private Integer reportType;

    @ApiModelProperty(value = "报告类型描述")
    private String reportTypeDesc;

    @ApiModelProperty(value = "统计时间范围-开始")
    private LocalDateTime timeRangeStart;

    @ApiModelProperty(value = "统计时间范围-结束")
    private LocalDateTime timeRangeEnd;

    @ApiModelProperty(value = "关联的测评ID列表")
    private List<Long> testIds;

    @ApiModelProperty(value = "综合得分")
    private BigDecimal overallScore;

    @ApiModelProperty(value = "掌握等级")
    private String masteryLevel;

    @ApiModelProperty(value = "报告摘要")
    private String reportSummary;

    @ApiModelProperty(value = "知识点掌握度分析")
    private Map<String, Object> knowledgeMastery;

    @ApiModelProperty(value = "能力维度分析")
    private Map<String, Object> abilityAnalysis;

    @ApiModelProperty(value = "学习效率分析")
    private Map<String, Object> learningEfficiency;

    @ApiModelProperty(value = "优势分析")
    private String strengths;

    @ApiModelProperty(value = "薄弱点分析")
    private String weaknesses;

    @ApiModelProperty(value = "改进建议")
    private String improvementSuggestions;

    @ApiModelProperty(value = "推荐学习资源")
    private List<Map<String, Object>> recommendedResources;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;
}
