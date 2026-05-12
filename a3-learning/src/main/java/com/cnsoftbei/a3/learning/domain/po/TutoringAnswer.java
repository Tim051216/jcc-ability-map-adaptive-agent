package com.cnsoftbei.a3.learning.domain.po;

import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.IdType;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import com.baomidou.mybatisplus.annotation.TableId;
import java.io.Serializable;

import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import com.cnsoftbei.a3.learning.enums.AnswerSource;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.Accessors;

import java.util.List;
import java.util.Map;

/**
 * <p>
 * 解答表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-10
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName(value = "tutoring_answer", autoResultMap = true)
@ApiModel(value="TutoringAnswer对象", description="解答表")
public class TutoringAnswer implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "解答ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "关联问题ID")
    private Long questionId;

    @ApiModelProperty(value = "所属会话ID")
    private Long sessionId;

    @ApiModelProperty(value = "解答来源：0-AI生成，1-人工解答")
    private AnswerSource answerSource;

    @ApiModelProperty(value = "解答者ID（人工解答时有效）")
    private Long answererId;

    @ApiModelProperty(value = "解答文字内容（Markdown格式）")
    private String answerText;

    @ApiModelProperty(value = "图解内容（Mermaid代码，JSON数组）")
    @com.baomidou.mybatisplus.annotation.TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> answerDiagrams;

    @ApiModelProperty(value = "推荐视频列表（JSON数组）")
    @com.baomidou.mybatisplus.annotation.TableField(typeHandler = JacksonTypeHandler.class)
    private List<Map<String, Object>> answerVideos;

    @ApiModelProperty(value = "参考资料来源（JSON数组）")
    @com.baomidou.mybatisplus.annotation.TableField(typeHandler = JacksonTypeHandler.class)
    private List<Map<String, Object>> referenceSources;

    @ApiModelProperty(value = "置信度分数（0-100）")
    private BigDecimal confidenceScore;

    @ApiModelProperty(value = "生成耗时（毫秒）")
    private Integer generationTime;

    @ApiModelProperty(value = "是否有帮助（用户评价）")
    private Boolean isHelpful;

    @ApiModelProperty(value = "用户评分（1-5星）")
    private Integer userRating;

    @ApiModelProperty(value = "用户反馈文字")
    private String userFeedback;

    @ApiModelProperty(value = "查看次数")
    private Integer viewCount;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
