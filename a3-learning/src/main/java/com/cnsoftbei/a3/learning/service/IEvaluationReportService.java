package com.cnsoftbei.a3.learning.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.cnsoftbei.a3.learning.domain.po.EvaluationReport;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * <p>
 * 评估报告服务接口
 * </p>
 *
 * @author A3 Team
 * @since 2026-05-09
 */
public interface IEvaluationReportService extends IService<EvaluationReport> {

    /**
     * 生成单次测评报告
     *
     * @param testId 测评ID
     * @param userId 学生ID
     * @return 报告ID
     */
    Long generateSingleTestReport(Long testId, Long userId);

    /**
     * 生成阶段性报告
     *
     * @param userId    学生ID
     * @param courseId  课程ID
     * @param startTime 开始时间
     * @param endTime   结束时间
     * @return 报告ID
     */
    Long generateStageReport(Long userId, Long courseId, LocalDateTime startTime, LocalDateTime endTime);

    /**
     * 生成综合报告
     *
     * @param userId   学生ID
     * @param courseId 课程ID
     * @return 报告ID
     */
    Long generateComprehensiveReport(Long userId, Long courseId);

    /**
     * 查询学生的报告列表
     *
     * @param userId   学生ID
     * @param courseId 课程ID (可选)
     * @return 报告列表
     */
    List<EvaluationReport> listByUser(Long userId, Long courseId);

    /**
     * 获取报告详情
     *
     * @param reportId 报告ID
     * @return 报告详情
     */
    EvaluationReport getReportDetail(Long reportId);

    /**
     * 获取知识点掌握度统计
     *
     * @param userId   学生ID
     * @param courseId 课程ID
     * @return 知识点掌握度数据
     */
    Map<String, Object> getKnowledgeMasteryStats(Long userId, Long courseId);

    /**
     * 获取学习效率分析
     *
     * @param userId   学生ID
     * @param courseId 课程ID
     * @return 学习效率数据
     */
    Map<String, Object> getLearningEfficiencyStats(Long userId, Long courseId);

    /**
     * 导出报告
     *
     * @param reportId 报告ID
     * @param format   导出格式 (pdf, excel, etc.)
     * @return 文件路径或下载链接
     */
    String exportReport(Long reportId, String format);
}
