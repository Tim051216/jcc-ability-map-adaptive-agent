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
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * <p>
 * 学习统计表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName(value = "learning_statistics", autoResultMap = true)
@ApiModel(value = "LearningStatistics对象", description = "学习统计表")
public class LearningStatistics implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "统计ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "用户ID")
    private Long userId;

    @ApiModelProperty(value = "统计日期")
    private LocalDate statDate;

    @ApiModelProperty(value = "总学习时长（分钟）")
    private Integer totalDuration;

    @ApiModelProperty(value = "视频学习时长（分钟）")
    private Integer videoDuration;

    @ApiModelProperty(value = "练习时长（分钟）")
    private Integer exerciseDuration;

    @ApiModelProperty(value = "测试时长（分钟）")
    private Integer testDuration;

    @ApiModelProperty(value = "完成任务数")
    private Integer completedTasks;

    @ApiModelProperty(value = "完成节点数")
    private Integer completedNodes;

    @ApiModelProperty(value = "完成资源数")
    private Integer completedResources;

    @ApiModelProperty(value = "练习题数")
    private Integer exerciseCount;

    @ApiModelProperty(value = "正确题数")
    private Integer correctCount;

    @ApiModelProperty(value = "正确率")
    private BigDecimal accuracyRate;

    @ApiModelProperty(value = "学习的知识点列表（JSON格式）")
    private String learnedKnowledgePoints;

    @ApiModelProperty(value = "掌握的知识点列表（JSON格式）")
    private String masteredKnowledgePoints;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
