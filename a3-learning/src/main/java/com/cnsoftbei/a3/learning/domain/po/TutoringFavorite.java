package com.cnsoftbei.a3.learning.domain.po;

import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.IdType;
import java.time.LocalDateTime;
import com.baomidou.mybatisplus.annotation.TableId;
import java.io.Serializable;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.Accessors;

/**
 * <p>
 * 收藏记录表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-10
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("tutoring_favorite")
@ApiModel(value="TutoringFavorite对象", description="收藏记录表")
public class TutoringFavorite implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "收藏ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "学生ID")
    private Long userId;

    @ApiModelProperty(value = "问题ID")
    private Long questionId;

    @ApiModelProperty(value = "解答ID")
    private Long answerId;

    @ApiModelProperty(value = "收藏备注")
    private String favoriteNote;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;
}
