package com.cnsoftbei.a3.learning.domain.po;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.experimental.Accessors;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@Accessors(chain = true)
@TableName("trial_feedback")
public class TrialFeedback implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;
    private String submissionCode;
    private Long userId;
    private String participantType;
    private String institution;
    private String jobRole;
    private String courseId;
    private Integer stageId;
    private Boolean flowCompleted;
    private Integer pathScore;
    private Integer resourceScore;
    private Integer courseScore;
    private Integer tutorScore;
    private Integer trustScore;
    private String mostHelpful;
    private String improvement;
    private Boolean continueUse;
    private Boolean authenticityConfirmed;
    private Boolean anonymousUseConsent;
    private LocalDateTime submittedAt;
}
