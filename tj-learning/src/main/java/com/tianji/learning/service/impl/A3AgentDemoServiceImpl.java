package com.tianji.learning.service.impl;

import com.tianji.common.utils.CollUtils;
import com.tianji.learning.domain.dto.a3.A3LearningRequestDTO;
import com.tianji.learning.domain.vo.a3.*;
import com.tianji.learning.service.IA3AgentDemoService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class A3AgentDemoServiceImpl implements IA3AgentDemoService {

    @Override
    public A3StudentProfileVO buildProfile(A3LearningRequestDTO requestDTO) {
        List<String> weakPoints = safeList(requestDTO.getWeakPoints());
        List<String> preferredResources = resolvePreferredResources(requestDTO);
        Integer hours = normalizeHours(requestDTO.getAvailableHoursPerWeek());
        return A3StudentProfileVO.builder()
                .studentName(requestDTO.getStudentName())
                .major(requestDTO.getMajor())
                .knowledgeBase(resolveKnowledgeBase(weakPoints))
                .cognitiveStyle(resolveCognitiveStyle(requestDTO.getRecentDialogue(), preferredResources))
                .interactionPreference(resolveInteractionPreference(preferredResources))
                .learningPace(resolveLearningPace(hours))
                .goalOrientation("围绕“" + requestDTO.getLearningGoal() + "”进行阶段化达成")
                .riskAlerts(resolveRiskAlerts(weakPoints, hours))
                .preferredResources(preferredResources)
                // 这里先用启发式规则生成画像说明，后续接入真实大模型时可直接替换实现。
                .updateSuggestion("建议每完成一次练习或答疑后，回写薄弱点与掌握情况，动态刷新画像。")
                .build();
    }

    @Override
    public A3ResourcePlanVO generateResources(A3LearningRequestDTO requestDTO) {
        A3StudentProfileVO profile = buildProfile(requestDTO);
        List<String> weakPoints = safeList(requestDTO.getWeakPoints());
        String focusPoint = weakPoints.isEmpty() ? "核心知识点梳理" : weakPoints.get(0);
        List<A3ResourceCardVO> cards = new ArrayList<>();
        cards.add(buildCard("讲解文档", requestDTO.getCourseName() + "知识讲解包", "围绕" + focusPoint + "生成分层讲解文档与重点摘要。", "Markdown文档", "内容策划智能体"));
        cards.add(buildCard("思维导图", requestDTO.getCourseName() + "知识图谱", "梳理课程主线、前置知识与易错连接关系。", "导图卡片", "知识建模智能体"));
        cards.add(buildCard("练习题", requestDTO.getCourseName() + "分层练习", "生成基础巩固、进阶提升、错因定位三类练习。", "题库卡片", "题目生成智能体"));
        cards.add(buildCard("实操案例", requestDTO.getCourseName() + "实践案例", "结合" + requestDTO.getMajor() + "场景生成可操作案例任务。", "案例任务卡", "项目实践智能体"));
        cards.add(buildCard("多模态资源", requestDTO.getCourseName() + "讲解视频脚本", "输出适合视频或动画生成的分镜与解说脚本。", "视频脚本卡", "多模态生成智能体"));
        return A3ResourcePlanVO.builder()
                .strategySummary("根据画像结果优先覆盖“" + profile.getKnowledgeBase() + "、" + profile.getLearningPace() + "、" + focusPoint + "”三类特征。")
                .progressMessage("已完成需求理解、资源拆解与生成排期，前端可进一步接入流式进度展示。")
                .resourceCards(cards)
                .build();
    }

    @Override
    public A3LearningPlanVO buildLearningPath(A3LearningRequestDTO requestDTO) {
        List<String> weakPoints = safeList(requestDTO.getWeakPoints());
        Integer hours = normalizeHours(requestDTO.getAvailableHoursPerWeek());
        String focusPoint = weakPoints.isEmpty() ? requestDTO.getCourseName() + "基础概念" : weakPoints.get(0);
        List<A3LearningPathStepVO> steps = List.of(
                buildStep(1, "构建基础认知", "完成课程主线梳理并明确关键概念边界", "讲解文档+思维导图", 45, "画像分析智能体"),
                buildStep(2, "攻克薄弱环节", "围绕" + focusPoint + "完成针对性练习与错因复盘", "练习题+错题解析", 60, "题目生成智能体"),
                buildStep(3, "形成迁移能力", "结合专业场景完成一个小型案例或项目实践", "实操案例", 90, "项目实践智能体"),
                buildStep(4, "多模态复习巩固", "通过视频脚本、图解或讲解卡片进行二次巩固", "视频/图解卡片", 40, "多模态生成智能体")
        );
        return A3LearningPlanVO.builder()
                .title(requestDTO.getStudentName() + "的" + requestDTO.getCourseName() + "个性化学习路径")
                .paceSuggestion("建议每周投入" + hours + "小时，采用“理解 - 练习 - 实践 - 复盘”的循环节奏。")
                .adjustmentSuggestion("若连续两次练习正确率低于预期，可自动提高讲解型资源占比，并缩短单次学习颗粒度。")
                .steps(steps)
                .build();
    }

    @Override
    public A3AgentPreviewVO preview(A3LearningRequestDTO requestDTO) {
        A3StudentProfileVO profile = buildProfile(requestDTO);
        A3ResourcePlanVO resourcePlan = generateResources(requestDTO);
        A3LearningPlanVO learningPlan = buildLearningPath(requestDTO);
        List<A3AgentStageVO> stages = List.of(
                buildStage("阶段1：对话理解", "画像分析智能体", "抽取专业、目标、薄弱点、资源偏好等关键特征。"),
                buildStage("阶段2：资源策划", "资源编排智能体", "将学习目标拆解为讲解、练习、案例、多模态等资源任务。"),
                buildStage("阶段3：内容生成", "题目生成/多模态生成/实践智能体", "分别生成题库、脚本、案例与知识导图等内容。"),
                buildStage("阶段4：路径规划", "学习规划智能体", "整合资源与画像结果，输出动态学习路径与调整建议。")
        );
        return A3AgentPreviewVO.builder()
                .profile(profile)
                .resourcePlan(resourcePlan)
                .learningPlan(learningPlan)
                .stages(stages)
                .build();
    }

    private A3ResourceCardVO buildCard(String type, String title, String summary, String format, String agentRole) {
        return A3ResourceCardVO.builder()
                .type(type)
                .title(title)
                .summary(summary)
                .format(format)
                .agentRole(agentRole)
                .build();
    }

    private A3LearningPathStepVO buildStep(Integer stepNo, String title, String objective, String resourceType,
                                           Integer estimatedMinutes, String agentRole) {
        return A3LearningPathStepVO.builder()
                .stepNo(stepNo)
                .title(title)
                .objective(objective)
                .resourceType(resourceType)
                .estimatedMinutes(estimatedMinutes)
                .agentRole(agentRole)
                .build();
    }

    private A3AgentStageVO buildStage(String stageName, String agentRole, String outputSummary) {
        return A3AgentStageVO.builder()
                .stageName(stageName)
                .agentRole(agentRole)
                .outputSummary(outputSummary)
                .build();
    }

    private List<String> safeList(List<String> source) {
        return CollUtils.isEmpty(source) ? List.of() : source;
    }

    private Integer normalizeHours(Integer availableHoursPerWeek) {
        return availableHoursPerWeek == null || availableHoursPerWeek < 1 ? 6 : availableHoursPerWeek;
    }

    private List<String> resolvePreferredResources(A3LearningRequestDTO requestDTO) {
        if (CollUtils.isNotEmpty(requestDTO.getPreferredResourceTypes())) {
            return requestDTO.getPreferredResourceTypes();
        }
        return List.of("讲解文档", "练习题", "实操案例");
    }

    private String resolveKnowledgeBase(List<String> weakPoints) {
        if (weakPoints.size() >= 3) {
            return "基础薄弱，需先补齐前置知识";
        }
        if (weakPoints.size() == 2) {
            return "具备基础，但存在若干关键断点";
        }
        return "基础较完整，可直接进入针对性提升";
    }

    private String resolveCognitiveStyle(String recentDialogue, List<String> preferredResources) {
        String dialogue = recentDialogue == null ? "" : recentDialogue;
        // 这里通过简单关键词判断认知风格，方便后续平滑替换为 LLM 推理结果。
        if (dialogue.contains("例子") || dialogue.contains("实践") || preferredResources.contains("实操案例")) {
            return "偏实践驱动，适合案例先行";
        }
        if (dialogue.contains("图") || preferredResources.contains("思维导图")) {
            return "偏结构化理解，适合图解与知识图谱";
        }
        return "偏讲解吸收，适合文档+练习递进学习";
    }

    private String resolveInteractionPreference(List<String> preferredResources) {
        if (preferredResources.contains("视频") || preferredResources.contains("多模态资源")) {
            return "偏好多模态讲解与分步提示";
        }
        if (preferredResources.contains("练习题")) {
            return "偏好边学边练与即时反馈";
        }
        return "偏好文本讲解与阶段复盘";
    }

    private String resolveLearningPace(Integer hours) {
        if (hours <= 4) {
            return "轻量慢节奏，每次学习颗粒度宜短";
        }
        if (hours <= 8) {
            return "稳态推进，适合每周形成固定闭环";
        }
        return "高投入快节奏，可增加实践与拓展任务";
    }

    private List<String> resolveRiskAlerts(List<String> weakPoints, Integer hours) {
        List<String> alerts = new ArrayList<>();
        if (weakPoints.size() >= 3) {
            alerts.add("当前薄弱点较多，建议优先聚焦前两项，避免学习目标过散。");
        }
        if (hours <= 4) {
            alerts.add("可投入时长较少，需控制资源生成数量，优先保证核心任务完成。");
        }
        if (alerts.isEmpty()) {
            alerts.add("当前画像较稳定，可结合练习结果继续动态细化。");
        }
        return alerts;
    }
}
