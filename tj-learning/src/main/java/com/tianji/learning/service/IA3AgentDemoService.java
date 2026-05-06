package com.tianji.learning.service;

import com.tianji.learning.domain.dto.a3.A3LearningRequestDTO;
import com.tianji.learning.domain.vo.a3.A3AgentPreviewVO;
import com.tianji.learning.domain.vo.a3.A3LearningPlanVO;
import com.tianji.learning.domain.vo.a3.A3ResourcePlanVO;
import com.tianji.learning.domain.vo.a3.A3StudentProfileVO;

public interface IA3AgentDemoService {

    A3StudentProfileVO buildProfile(A3LearningRequestDTO requestDTO);

    A3ResourcePlanVO generateResources(A3LearningRequestDTO requestDTO);

    A3LearningPlanVO buildLearningPath(A3LearningRequestDTO requestDTO);

    A3AgentPreviewVO preview(A3LearningRequestDTO requestDTO);
}
