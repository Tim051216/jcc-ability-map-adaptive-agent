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
 * 学习路径主表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName(value = "learning_path", autoResultMap = true)
@ApiModel(value = "LearningPath对象", description = "学习路径主表")
public class LearningPath implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "路径ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "学生用户ID")
    private Long userId;

    @ApiModelProperty(value = "关联的学生画像ID")
    private Long profileId;

    @ApiModelProperty(value = "路径名称")
    private String pathName;

    @ApiModelProperty(value = "路径描述")
    private String pathDesc;

    @ApiModelProperty(value = "目标课程ID")
    private Long targetCourseId;

    @ApiModelProperty(value = "目标知识点列表（JSON格式）")
    private String targetKnowledgePoints;

    @ApiModelProperty(value = "路径状态：0-草稿，1-已激活，2-进行中，3-已完成，4-已暂停，5-已废弃")
    private Integer status;

    @ApiModelProperty(value = "路径类型：1-AI自动规划，2-教师指定，3-混合模式")
    private Integer pathType;

    @ApiModelProperty(value = "总节点数")
    private Integer totalNodes;

    @ApiModelProperty(value = "已完成节点数")
    private Integer completedNodes;

    @ApiModelProperty(value = "当前节点ID")
    private Long currentNodeId;

    @ApiModelProperty(value = "完成百分比(0-100)")
    private Integer progressPercentage;

    @ApiModelProperty(value = "预估总时长（分钟）")
    private Integer estimatedDuration;

    @ApiModelProperty(value = "实际学习时长（分钟）")
    private Integer actualDuration;

    @ApiModelProperty(value = "整体难度等级：1-入门，2-初级，3-中级，4-高级，5-专家")
    private Integer difficultyLevel;

    @ApiModelProperty(value = "是否启用自适应调整")
    private Boolean adaptiveEnabled;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty(value = "激活时间")
    private LocalDateTime activateTime;

    @ApiModelProperty(value = "开始学习时间")
    private LocalDateTime startTime;

    @ApiModelProperty(value = "完成时间")
    private LocalDateTime completeTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
