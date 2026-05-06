package com.tianji.learning.domain.vo.a3;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@ApiModel("学生画像结果")
public class A3StudentProfileVO {

    @ApiModelProperty("学生姓名")
    private String studentName;

    @ApiModelProperty("专业方向")
    private String major;

    @ApiModelProperty("知识基础")
    private String knowledgeBase;

    @ApiModelProperty("认知风格")
    private String cognitiveStyle;

    @ApiModelProperty("交互偏好")
    private String interactionPreference;

    @ApiModelProperty("学习节奏")
    private String learningPace;

    @ApiModelProperty("目标导向")
    private String goalOrientation;

    @ApiModelProperty("风险提醒")
    private List<String> riskAlerts;

    @ApiModelProperty("推荐资源偏好")
    private List<String> preferredResources;

    @ApiModelProperty("画像更新建议")
    private String updateSuggestion;
}
