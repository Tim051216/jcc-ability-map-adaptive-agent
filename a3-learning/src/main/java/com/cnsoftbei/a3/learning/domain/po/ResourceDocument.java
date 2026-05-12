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
 * 文档资源详情表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("resource_document")
@ApiModel(value = "ResourceDocument对象", description = "文档资源详情表")
public class ResourceDocument implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "文档ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "资源ID")
    private Long resourceId;

    @ApiModelProperty(value = "文档标题")
    private String title;

    @ApiModelProperty(value = "Markdown内容")
    private String contentMarkdown;

    @ApiModelProperty(value = "HTML内容（渲染后）")
    private String contentHtml;

    @ApiModelProperty(value = "字数统计")
    private Integer wordCount;

    @ApiModelProperty(value = "是否包含公式")
    private Boolean hasFormula;

    @ApiModelProperty(value = "是否包含图片")
    private Boolean hasImage;

    @ApiModelProperty(value = "是否包含代码块")
    private Boolean hasCode;

    @ApiModelProperty(value = "文档大纲（JSON格式）")
    private String outline;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
