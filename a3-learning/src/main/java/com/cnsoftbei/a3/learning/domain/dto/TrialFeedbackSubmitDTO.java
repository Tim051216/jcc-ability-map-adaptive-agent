package com.cnsoftbei.a3.learning.domain.dto;

import lombok.Data;

import javax.validation.constraints.AssertTrue;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;

@Data
public class TrialFeedbackSubmitDTO {

    @NotBlank
    private String participantType;

    @Size(max = 120)
    private String institution;

    @NotBlank
    @Size(max = 64)
    private String jobRole;

    @Size(max = 64)
    private String courseId;

    private Integer stageId;

    @AssertTrue(message = "请先完成岗位学习主流程")
    private Boolean flowCompleted;

    @NotNull @Min(1) @Max(5)
    private Integer pathScore;

    @NotNull @Min(1) @Max(5)
    private Integer resourceScore;

    @NotNull @Min(1) @Max(5)
    private Integer courseScore;

    @NotNull @Min(1) @Max(5)
    private Integer tutorScore;

    @NotNull @Min(1) @Max(5)
    private Integer trustScore;

    @NotBlank
    @Size(min = 5, max = 1000)
    private String mostHelpful;

    @NotBlank
    @Size(min = 5, max = 1000)
    private String improvement;

    @NotNull
    private Boolean continueUse;

    @AssertTrue(message = "必须确认本人已真实体验")
    private Boolean authenticityConfirmed;

    @NotNull
    private Boolean anonymousUseConsent;
}
