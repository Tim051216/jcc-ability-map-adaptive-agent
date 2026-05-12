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
 * 学习进度记录表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName(value = "learning_progress", autoResultMap = true)
@ApiModel(value = "LearningProgress对象", description = "学习进度记录表")
public class LearningProgress implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "进度ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "路径ID")
    private Long pathId;

    @ApiModelProperty(value = "节点ID")
    private Long nodeId;

    @ApiModelProperty(value = "用户ID")
    private Long userId;

    @ApiModelProperty(value = "进度类型：1-节点开始，2-资源学习，3-节点完成，4-节点暂缓，5-节点跳过")
    private Integer progressType;

    @ApiModelProperty(value = "进度详细数据（JSON格式）")
    private String progressData;

    @ApiModelProperty(value = "进度百分比(0-100)")
    private Integer progressPercentage;

    @ApiModelProperty(value = "本次学习时长（秒）")
    private Integer duration;

    @ApiModelProperty(value = "累计学习时长（秒）")
    private Integer cumulativeDuration;

    @ApiModelProperty(value = "学习结果数据（JSON格式）")
    private String resultData;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;
}
