package com.cnsoftbei.a3.learning.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.cnsoftbei.a3.learning.domain.dto.TrialFeedbackSubmitDTO;
import com.cnsoftbei.a3.learning.domain.po.TrialFeedback;

import java.util.List;

public interface ITrialFeedbackService extends IService<TrialFeedback> {
    TrialFeedback submit(TrialFeedbackSubmitDTO dto);

    List<TrialFeedback> queryMine();
}
