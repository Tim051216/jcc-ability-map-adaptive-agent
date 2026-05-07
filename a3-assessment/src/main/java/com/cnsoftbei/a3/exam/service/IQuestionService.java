package com.cnsoftbei.a3.exam.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.cnsoftbei.a3.api.dto.exam.QuestionDTO;
import com.cnsoftbei.a3.common.domain.dto.PageDTO;
import com.cnsoftbei.a3.exam.domain.dto.QuestionFormDTO;
import com.cnsoftbei.a3.exam.domain.po.Question;
import com.cnsoftbei.a3.exam.domain.query.QuestionPageQuery;
import com.cnsoftbei.a3.exam.domain.vo.QuestionDetailVO;
import com.cnsoftbei.a3.exam.domain.vo.QuestionPageVO;

import java.util.List;
import java.util.Map;

/**
 * <p>
 * 题目 服务类
 * </p>
 *
 * @author 虎哥
 * @since 2022-09-02
 */
public interface IQuestionService extends IService<Question> {

    void addQuestion(QuestionFormDTO questionFormDTO);

    void updateQuestion(QuestionFormDTO questionDTO);

    void deleteQuestionById(Long id);

    PageDTO<QuestionPageVO> queryQuestionByPage(QuestionPageQuery query);

    QuestionDetailVO queryQuestionDetailById(Long id);

    List<QuestionDTO> queryQuestionByIds(List<Long> ids);

    Map<Long, Integer> countQuestionNumOfCreater(List<Long> createrIds);

    List<QuestionDTO> queryQuestionByBizId(Long bizId);

    Boolean checkNameValid(String name);

    Map<Long, Integer> queryQuestionScores(List<Long> ids);
}
