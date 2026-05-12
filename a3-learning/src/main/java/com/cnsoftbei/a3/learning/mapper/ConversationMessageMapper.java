package com.cnsoftbei.a3.learning.mapper;

import com.cnsoftbei.a3.learning.domain.po.ConversationMessage;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * <p>
 * 对话消息表 Mapper 接口
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Mapper
public interface ConversationMessageMapper extends BaseMapper<ConversationMessage> {

}
