package com.cnsoftbei.a3.learning.service;

import com.cnsoftbei.a3.learning.domain.dto.a3.A3LearningRequestDTO;
import com.cnsoftbei.a3.learning.domain.vo.a3.A3AgentPreviewVO;
import com.cnsoftbei.a3.learning.domain.vo.a3.A3LearningPlanVO;
import com.cnsoftbei.a3.learning.domain.vo.a3.A3ResourcePlanVO;
import com.cnsoftbei.a3.learning.domain.vo.a3.A3StudentProfileVO;

public interface IA3AgentDemoService {

    A3StudentProfileVO buildProfile(A3LearningRequestDTO requestDTO);

    A3ResourcePlanVO generateResources(A3LearningRequestDTO requestDTO);

    A3LearningPlanVO buildLearningPath(A3LearningRequestDTO requestDTO);

    A3AgentPreviewVO preview(A3LearningRequestDTO requestDTO);
}
