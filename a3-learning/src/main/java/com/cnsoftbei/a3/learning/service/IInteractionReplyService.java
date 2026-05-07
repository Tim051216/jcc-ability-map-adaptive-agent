package com.cnsoftbei.a3.learning.service;

import com.cnsoftbei.a3.common.domain.dto.PageDTO;
import com.cnsoftbei.a3.learning.domain.dto.ReplyDTO;
import com.cnsoftbei.a3.learning.domain.po.InteractionReply;
import com.baomidou.mybatisplus.extension.service.IService;
import com.cnsoftbei.a3.learning.domain.query.QuestionAdminPageQuery;
import com.cnsoftbei.a3.learning.domain.query.ReplyPageQuery;
import com.cnsoftbei.a3.learning.domain.vo.QuestionAdminVO;
import com.cnsoftbei.a3.learning.domain.vo.ReplyVO;

/**
 * <p>
 * 互动问题的回答或评论 服务类
 * </p>
 *
 * @author fenny
 * @since 2023-11-24
 */
public interface IInteractionReplyService extends IService<InteractionReply> {

    void addReplyOrAnswer(ReplyDTO dto);

    PageDTO<ReplyVO> queryReplyOrAnswerPage(ReplyPageQuery query, Boolean isAdmin);

    PageDTO<ReplyVO> queryReplyOrAnswerPageAdmin(ReplyPageQuery query);

    void hiddenReplyAdmin(Long id, Boolean hidden);

    ReplyVO queryReplyById(Long id);
}
