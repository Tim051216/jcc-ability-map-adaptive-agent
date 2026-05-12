package com.cnsoftbei.a3.learning.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cnsoftbei.a3.common.exceptions.BizIllegalException;
import com.cnsoftbei.a3.common.utils.UserContext;
import com.cnsoftbei.a3.learning.domain.po.EvaluationTest;
import com.cnsoftbei.a3.learning.mapper.EvaluationTestMapper;
import com.cnsoftbei.a3.learning.service.IEvaluationTestService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * <p>
 * 测评服务实现类
 * </p>
 *
 * @author A3 Team
 * @since 2026-05-09
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EvaluationTestServiceImpl extends ServiceImpl<EvaluationTestMapper, EvaluationTest>
        implements IEvaluationTestService {

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Long createTest(EvaluationTest test) {
        // 设置创建者
        Long userId = UserContext.getUser();
        test.setCreatorId(userId);

        // 设置默认状态为草稿
        if (test.getStatus() == null) {
            test.setStatus(0);
        }

        // 设置创建时间
        test.setCreateTime(LocalDateTime.now());
        test.setUpdateTime(LocalDateTime.now());

        // 保存测评
        boolean success = save(test);
        if (!success) {
            throw new BizIllegalException("创建测评失败");
        }

        log.info("创建测评成功: testId={}, title={}", test.getId(), test.getTitle());

        return test.getId();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean publishTest(Long testId) {
        EvaluationTest test = getById(testId);
        if (test == null) {
            throw new BizIllegalException("测评不存在");
        }

        if (test.getStatus() == 1) {
            throw new BizIllegalException("测评已发布");
        }

        // 检查题目数量
        if (test.getQuestionCount() == 0) {
            throw new BizIllegalException("测评没有题目,无法发布");
        }

        // 更新状态为已发布
        test.setStatus(1);
        test.setUpdateTime(LocalDateTime.now());

        boolean success = updateById(test);

        log.info("发布测评: testId={}, success={}", testId, success);

        return success;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean closeTest(Long testId) {
        EvaluationTest test = getById(testId);
        if (test == null) {
            throw new BizIllegalException("测评不存在");
        }

        // 更新状态为已关闭
        test.setStatus(2);
        test.setUpdateTime(LocalDateTime.now());

        boolean success = updateById(test);

        log.info("关闭测评: testId={}, success={}", testId, success);

        return success;
    }

    @Override
    public List<EvaluationTest> listByCourseId(Long courseId) {
        QueryWrapper<EvaluationTest> wrapper = new QueryWrapper<>();
        wrapper.eq("course_id", courseId)
                .orderByDesc("create_time");

        return list(wrapper);
    }

    @Override
    public List<EvaluationTest> listByChapterId(Long chapterId) {
        QueryWrapper<EvaluationTest> wrapper = new QueryWrapper<>();
        wrapper.eq("chapter_id", chapterId)
                .orderByDesc("create_time");

        return list(wrapper);
    }

    @Override
    public List<EvaluationTest> listByTestType(Long courseId, Integer testType) {
        QueryWrapper<EvaluationTest> wrapper = new QueryWrapper<>();
        wrapper.eq("course_id", courseId)
                .eq("test_type", testType)
                .orderByDesc("create_time");

        return list(wrapper);
    }
}
