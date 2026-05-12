package com.cnsoftbei.a3.learning.domain.po;

import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.IdType;
import java.time.LocalDateTime;
import com.baomidou.mybatisplus.annotation.TableId;
import java.io.Serializable;

import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import com.cnsoftbei.a3.learning.enums.TutoringQuestionStatus;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.Accessors;

import java.util.List;

/**
 * <p>
 * 问题表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-10
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName(value = "tutoring_question", autoResultMap = true)
@ApiModel(value="TutoringQuestion对象", description="问题表")
public class TutoringQuestion implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "问题ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "所属会话ID")
    private Long sessionId;

    @ApiModelProperty(value = "提问学生ID")
    private Long userId;

    @ApiModelProperty(value = "关联课程ID")
    private Long courseId;

    @ApiModelProperty(value = "关联章节ID")
    private Long sectionId;

    @ApiModelProperty(value = "问题文字内容")
    private String questionText;

    @ApiModelProperty(value = "问题图片URL列表（JSON数组）")
    @com.baomidou.mybatisplus.annotation.TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> questionImages;

    @ApiModelProperty(value = "问题类型（概念理解/解题方法/代码调试等）")
    private String questionType;

    @ApiModelProperty(value = "关联知识点列表（JSON数组）")
    @com.baomidou.mybatisplus.annotation.TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> knowledgePoints;

    @ApiModelProperty(value = "问题难度：1-简单，2-中等，3-困难")
    private Integer difficultyLevel;

    @ApiModelProperty(value = "问题状态：0-待处理，1-已解答，2-已升级，3-已关闭")
    private TutoringQuestionStatus questionStatus;

    @ApiModelProperty(value = "是否已有解答")
    private Boolean hasAnswer;

    @ApiModelProperty(value = "是否已升级到人工")
    private Boolean isEscalated;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
