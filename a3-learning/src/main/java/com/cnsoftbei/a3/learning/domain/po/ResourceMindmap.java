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
 * 思维导图资源详情表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("resource_mindmap")
@ApiModel(value = "ResourceMindmap对象", description = "思维导图资源详情表")
public class ResourceMindmap implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "思维导图ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "资源ID")
    private Long resourceId;

    @ApiModelProperty(value = "思维导图标题")
    private String title;

    @ApiModelProperty(value = "Mermaid代码")
    private String mermaidCode;

    @ApiModelProperty(value = "节点数量")
    private Integer nodeCount;

    @ApiModelProperty(value = "最大层级深度")
    private Integer maxDepth;

    @ApiModelProperty(value = "布局类型：TB-上下，LR-左右")
    private String layoutType;

    @ApiModelProperty(value = "样式配置（JSON格式）")
    private String styleConfig;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
