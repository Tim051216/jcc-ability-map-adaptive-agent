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
 * 视频资源详情表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("resource_video")
@ApiModel(value = "ResourceVideo对象", description = "视频资源详情表")
public class ResourceVideo implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "视频ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "资源ID")
    private Long resourceId;

    @ApiModelProperty(value = "视频标题")
    private String title;

    @ApiModelProperty(value = "视频URL")
    private String videoUrl;

    @ApiModelProperty(value = "封面图URL")
    private String coverUrl;

    @ApiModelProperty(value = "视频时长（秒）")
    private Integer duration;

    @ApiModelProperty(value = "视频格式：mp4, avi等")
    private String videoFormat;

    @ApiModelProperty(value = "分辨率：1080p, 720p等")
    private String resolution;

    @ApiModelProperty(value = "文件大小（字节）")
    private Long fileSize;

    @ApiModelProperty(value = "来源类型：1-平台自有，2-外部推荐")
    private Integer sourceType;

    @ApiModelProperty(value = "来源平台")
    private String sourcePlatform;

    @ApiModelProperty(value = "原始URL")
    private String sourceUrl;

    @ApiModelProperty(value = "标签（逗号分隔）")
    private String tags;

    @ApiModelProperty(value = "视频描述")
    private String description;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
