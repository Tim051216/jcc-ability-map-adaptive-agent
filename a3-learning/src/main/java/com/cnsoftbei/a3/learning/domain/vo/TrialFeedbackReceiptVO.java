package com.cnsoftbei.a3.learning.domain.vo;

import com.cnsoftbei.a3.learning.domain.po.TrialFeedback;
import lombok.Data;
import lombok.experimental.Accessors;

import java.time.LocalDateTime;

@Data
@Accessors(chain = true)
public class TrialFeedbackReceiptVO {
    private String submissionCode;
    private String participantType;
    private String jobRole;
    private LocalDateTime submittedAt;
    private Boolean anonymousUseConsent;

    public static TrialFeedbackReceiptVO from(TrialFeedback feedback) {
        return new TrialFeedbackReceiptVO()
                .setSubmissionCode(feedback.getSubmissionCode())
                .setParticipantType(feedback.getParticipantType())
                .setJobRole(feedback.getJobRole())
                .setSubmittedAt(feedback.getSubmittedAt())
                .setAnonymousUseConsent(feedback.getAnonymousUseConsent());
    }
}
