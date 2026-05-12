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
 * 学习资源主表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("learning_resource")
@ApiModel(value = "LearningResource对象", description = "学习资源主表")
public class LearningResource implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "资源ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "资源名称")
    private String resourceName;

    @ApiModelProperty(value = "资源类型：1-课程讲解文档，2-知识点思维导图，3-分层练习题库，4-教学视频/动画，5-代码实操案例")
    private Integer resourceType;

    @ApiModelProperty(value = "关联知识点ID")
    private Long knowledgePointId;

    @ApiModelProperty(value = "关联课程ID")
    private Long courseId;

    @ApiModelProperty(value = "关联章节ID")
    private Long chapterId;

    @ApiModelProperty(value = "关联小节ID")
    private Long sectionId;

    @ApiModelProperty(value = "目标学生ID（个性化生成）")
    private Long studentId;

    @ApiModelProperty(value = "难度等级：1-基础，2-进阶，3-拔高")
    private Integer difficultyLevel;

    @ApiModelProperty(value = "资源状态：1-生成中，2-已完成，3-生成失败")
    private Integer status;

    @ApiModelProperty(value = "资源版本号")
    private Integer version;

    @ApiModelProperty(value = "资源文件URL（对象存储）")
    private String fileUrl;

    @ApiModelProperty(value = "文件大小（字节）")
    private Long fileSize;

    @ApiModelProperty(value = "文件格式：md, json, pdf, mp4等")
    private String fileFormat;

    @ApiModelProperty(value = "关联生成任务ID")
    private Long generationTaskId;

    @ApiModelProperty(value = "质量评分（0-1）")
    private BigDecimal qualityScore;

    @ApiModelProperty(value = "查看次数")
    private Integer viewCount;

    @ApiModelProperty(value = "下载次数")
    private Integer downloadCount;

    @ApiModelProperty(value = "收藏次数")
    private Integer favoriteCount;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
