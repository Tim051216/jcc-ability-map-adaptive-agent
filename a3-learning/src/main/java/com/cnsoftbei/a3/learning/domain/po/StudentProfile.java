package com.cnsoftbei.a3.learning.domain.po;

import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.Accessors;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * <p>
 * 学生学习画像主表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName(value = "student_profile", autoResultMap = true)
@ApiModel(value = "StudentProfile对象", description = "学生学习画像主表")
public class StudentProfile implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "画像ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "学生用户ID")
    private Long userId;

    @ApiModelProperty(value = "画像版本号")
    private Integer version;

    @ApiModelProperty(value = "知识基础维度：已掌握知识点、薄弱环节、学科背景")
    private String knowledgeBase;

    @ApiModelProperty(value = "认知风格维度：学习偏好、思维方式、理解速度")
    private String cognitiveStyle;

    @ApiModelProperty(value = "学习进度维度：当前进度、完成率、学习节奏")
    private String learningProgress;

    @ApiModelProperty(value = "易错点偏好维度：常见错误类型、易混淆概念")
    private String errorPreference;

    @ApiModelProperty(value = "兴趣方向维度：感兴趣领域、学习动机、目标方向")
    private String interestDirection;

    @ApiModelProperty(value = "学习习惯维度：学习时间偏好、学习频率、专注时长")
    private String learningHabit;

    @ApiModelProperty(value = "学习标签，逗号分隔")
    private String tags;

    @ApiModelProperty(value = "画像完整度百分比(0-100)")
    private Integer completeness;

    @ApiModelProperty(value = "画像状态：0-未激活，1-正常，2-已过期")
    private Integer status;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;

    @ApiModelProperty(value = "最后学习行为时间")
    private LocalDateTime lastBehaviorTime;
}
