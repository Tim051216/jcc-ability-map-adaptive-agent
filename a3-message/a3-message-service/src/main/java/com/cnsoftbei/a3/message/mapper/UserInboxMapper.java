package com.cnsoftbei.a3.message.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cnsoftbei.a3.message.domain.po.UserInbox;

/**
 * <p>
 * 用户通知记录 Mapper 接口
 * </p>
 *
 * @author 虎哥
 * @since 2022-08-20
 */
public interface UserInboxMapper extends BaseMapper<UserInbox> {

    UserInbox queryLatestPublicNotice(Long userId);
}
