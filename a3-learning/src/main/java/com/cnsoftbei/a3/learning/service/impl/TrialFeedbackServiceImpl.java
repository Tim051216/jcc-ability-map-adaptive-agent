package com.cnsoftbei.a3.learning.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cnsoftbei.a3.common.utils.UserContext;
import com.cnsoftbei.a3.learning.domain.dto.TrialFeedbackSubmitDTO;
import com.cnsoftbei.a3.learning.domain.po.TrialFeedback;
import com.cnsoftbei.a3.learning.mapper.TrialFeedbackMapper;
import com.cnsoftbei.a3.learning.service.ITrialFeedbackService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class TrialFeedbackServiceImpl extends ServiceImpl<TrialFeedbackMapper, TrialFeedback>
        implements ITrialFeedbackService {

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TrialFeedback submit(TrialFeedbackSubmitDTO dto) {
        Long userId = UserContext.requireUser();
        String participantType = dto.getParticipantType().trim().toUpperCase(Locale.ROOT);
        if (!"STUDENT".equals(participantType) && !"TEACHER".equals(participantType)) {
            throw new IllegalArgumentException("参与者身份仅支持学生或教师");
        }

        LocalDateTime now = LocalDateTime.now();
        String submissionCode = "TF-" + now.format(DateTimeFormatter.ofPattern("yyyyMMdd")) + "-"
                + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        TrialFeedback feedback = new TrialFeedback()
                .setSubmissionCode(submissionCode)
                .setUserId(userId)
                .setParticipantType(participantType)
                .setInstitution(normalizeOptional(dto.getInstitution()))
                .setJobRole(dto.getJobRole().trim())
                .setCourseId(normalizeOptional(dto.getCourseId()))
                .setStageId(dto.getStageId())
                .setFlowCompleted(Boolean.TRUE)
                .setPathScore(dto.getPathScore())
                .setResourceScore(dto.getResourceScore())
                .setCourseScore(dto.getCourseScore())
                .setTutorScore(dto.getTutorScore())
                .setTrustScore(dto.getTrustScore())
                .setMostHelpful(dto.getMostHelpful().trim())
                .setImprovement(dto.getImprovement().trim())
                .setContinueUse(dto.getContinueUse())
                .setAuthenticityConfirmed(Boolean.TRUE)
                .setAnonymousUseConsent(dto.getAnonymousUseConsent())
                .setSubmittedAt(now);
        save(feedback);
        return feedback;
    }

    @Override
    public List<TrialFeedback> queryMine() {
        Long userId = UserContext.requireUser();
        return lambdaQuery()
                .eq(TrialFeedback::getUserId, userId)
                .orderByDesc(TrialFeedback::getSubmittedAt)
                .list();
    }

    private static String normalizeOptional(String value) {
        if (value == null || value.trim().isEmpty()) return null;
        return value.trim();
    }
}
