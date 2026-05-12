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
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * <p>
 * 对话提取信息表
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("extracted_info")
@ApiModel(value = "ExtractedInfo对象", description = "对话提取信息表")
public class ExtractedInfo implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty(value = "信息ID")
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    @ApiModelProperty(value = "会话ID")
    private Long sessionId;

    @ApiModelProperty(value = "消息ID")
    private Long messageId;

    @ApiModelProperty(value = "用户ID")
    private Long userId;

    @ApiModelProperty(value = "所属维度")
    private String dimension;

    @ApiModelProperty(value = "信息键")
    private String infoKey;

    @ApiModelProperty(value = "信息值")
    private String infoValue;

    @ApiModelProperty(value = "置信度(0.00-1.00)")
    private BigDecimal confidence;

    @ApiModelProperty(value = "提取方法：llm-大模型提取，rule-规则提取")
    private String extractionMethod;

    @ApiModelProperty(value = "是否已验证")
    private Boolean verified;

    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;
}
