package com.cnsoftbei.a3.learning.domain.dto;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;

/** Request payload for an authenticated trial-feedback submission. */
@Data
@ApiModel(description = "岗位自适应学习试用反馈")
public class TrialFeedbackSubmitDTO {
    @NotBlank
    @ApiModelProperty("参与者身份：STUDENT 或 TEACHER")
    private String participantType;

    @ApiModelProperty("学校或机构，可选")
    private String institution;

    @NotBlank
    @ApiModelProperty("试用者岗位/年级")
    private String jobRole;

    @ApiModelProperty("课程标识，可选")
    private String courseId;

    @Min(1)
    @ApiModelProperty("完成的试用阶段")
    private Integer stageId;

    @Min(0) @Max(100)
    private Integer pathScore;
    @Min(0) @Max(100)
    private Integer resourceScore;
    @Min(0) @Max(100)
    private Integer courseScore;
    @Min(0) @Max(100)
    private Integer tutorScore;
    @Min(0) @Max(100)
    private Integer trustScore;

    @NotBlank
    @ApiModelProperty("最有帮助的功能")
    private String mostHelpful;

    @NotBlank
    @ApiModelProperty("改进建议")
    private String improvement;

    private Boolean continueUse;
    private Boolean anonymousUseConsent;
}
