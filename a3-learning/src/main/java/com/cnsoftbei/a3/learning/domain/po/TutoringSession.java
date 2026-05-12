package com.cnsoftbei.a3.learning.domain.po;

import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.IdType;
import java.time.LocalDateTime;
import com.baomidou.mybatisplus.annotation.TableId;
import java.io.Serializable;

import com.cnsoftbei.a3.learning.enums.TutoringSessionStatus;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.Accessors;

/**
 * <p>
 * 答疑会话表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-10
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("tutoring_session")
@ApiModel(value="TutoringSession对象", description="答疑会话表")
public class TutoringSession implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "会话ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "学生ID")
    private Long userId;

    @ApiModelProperty(value = "关联课程ID（可选）")
    private Long courseId;

    @ApiModelProperty(value = "关联章节ID（可选）")
    private Long sectionId;

    @ApiModelProperty(value = "会话状态：0-进行中，1-已结束，2-已升级")
    private TutoringSessionStatus sessionStatus;

    @ApiModelProperty(value = "问题数量")
    private Integer questionCount;

    @ApiModelProperty(value = "会话开始时间")
    private LocalDateTime startTime;

    @ApiModelProperty(value = "会话结束时间")
    private LocalDateTime endTime;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
