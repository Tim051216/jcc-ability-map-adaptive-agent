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
 * 代码案例资源详情表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("resource_code_example")
@ApiModel(value = "ResourceCodeExample对象", description = "代码案例资源详情表")
public class ResourceCodeExample implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "代码案例ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "资源ID")
    private Long resourceId;

    @ApiModelProperty(value = "案例标题")
    private String title;

    @ApiModelProperty(value = "案例描述")
    private String description;

    @ApiModelProperty(value = "编程语言：Java, Python, JavaScript等")
    private String programmingLanguage;

    @ApiModelProperty(value = "代码内容")
    private String codeContent;

    @ApiModelProperty(value = "代码结构（JSON格式，多文件）")
    private String codeStructure;

    @ApiModelProperty(value = "运行说明")
    private String runInstructions;

    @ApiModelProperty(value = "预期输出")
    private String expectedOutput;

    @ApiModelProperty(value = "依赖项（JSON格式）")
    private String dependencies;

    @ApiModelProperty(value = "难度等级：1-基础，2-进阶，3-拔高")
    private Integer difficultyLevel;

    @ApiModelProperty(value = "是否包含测试用例")
    private Boolean hasTestCases;

    @ApiModelProperty(value = "是否可直接运行")
    private Boolean isRunnable;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
