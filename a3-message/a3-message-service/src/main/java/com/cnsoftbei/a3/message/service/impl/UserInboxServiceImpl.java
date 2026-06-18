package com.cnsoftbei.a3.message.service.impl;

import com.baomidou.mybatisplus.core.metadata.OrderItem;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cnsoftbei.a3.api.dto.user.UserDTO;
import com.cnsoftbei.a3.common.domain.dto.PageDTO;
import com.cnsoftbei.a3.common.utils.CollUtils;
import com.cnsoftbei.a3.common.utils.UserContext;
import com.cnsoftbei.a3.message.config.MessageProperties;
import com.cnsoftbei.a3.message.domain.dto.UserInboxDTO;
import com.cnsoftbei.a3.message.domain.dto.UserInboxFormDTO;
import com.cnsoftbei.a3.message.domain.po.NoticeTemplate;
import com.cnsoftbei.a3.message.domain.po.PublicNotice;
import com.cnsoftbei.a3.message.domain.po.UserInbox;
import com.cnsoftbei.a3.message.domain.query.UserInboxQuery;
import com.cnsoftbei.a3.message.enums.NoticeType;
import com.cnsoftbei.a3.message.mapper.UserInboxMapper;
import com.cnsoftbei.a3.message.service.IPublicNoticeService;
import com.cnsoftbei.a3.message.service.IUserInboxService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserInboxServiceImpl extends ServiceImpl<UserInboxMapper, UserInbox> implements IUserInboxService {

    private final MessageProperties properties;
    private final IPublicNoticeService publicNoticeService;

    @Override
    public void saveNoticeToInbox(NoticeTemplate notice, List<UserDTO> users) {
        LocalDateTime pushTime = LocalDateTime.now();
        LocalDateTime expireTime = pushTime.plusMonths(properties.getMessageTtlMonths());
        List<UserInbox> list = new ArrayList<>(users.size());
        for (UserDTO user : users) {
            UserInbox box = new UserInbox();
            box.setTitle(notice.getTitle());
            box.setContent(notice.getContent());
            box.setUserId(user.getId());
            box.setType(notice.getType());
            box.setPushTime(pushTime);
            box.setExpireTime(expireTime);
            list.add(box);
        }
        saveBatch(list);
    }

    @Override
    @Transactional
    public PageDTO<UserInboxDTO> queryUserInBoxesPage(UserInboxQuery query) {
        return queryUserInBoxesPage(UserContext.getUser(), query);
    }

    @Override
    @Transactional
    public PageDTO<UserInboxDTO> queryUserInBoxesPage(Long userId, UserInboxQuery query) {
        if (userId == null) {
            userId = 0L;
        }

        UserInbox latest = null;
        try {
            latest = getBaseMapper().queryLatestPublicNotice(userId);
        } catch (Exception ignored) {
            // Local bootstrap may miss legacy mapper wiring; inbox query should still work.
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime minTime = now.minusMonths(properties.getNoticeTtlMonths());
        if (latest != null && latest.getPushTime() != null && latest.getPushTime().isAfter(minTime)) {
            minTime = latest.getPushTime();
        }

        Page<PublicNotice> noticePage = new Page<PublicNotice>(1, 200)
                .addOrder(new OrderItem("push_time", false));
        noticePage = publicNoticeService.page(noticePage, Wrappers.<PublicNotice>query()
                .ge("push_time", minTime)
                .orderByDesc("push_time"));

        if (CollUtils.isNotEmpty(noticePage.getRecords())) {
            saveNoticeListToInbox(noticePage.getRecords(), userId);
        }

        Page<UserInbox> userInboxPage = query.toMpPage("push_time", false);
        userInboxPage = page(userInboxPage, Wrappers.<UserInbox>query()
                .eq("user_id", userId)
                .eq(query.getIsRead() != null, "is_read", query.getIsRead())
                .eq(query.getType() != null, "type", query.getType())
                .orderByDesc("push_time"));
        return PageDTO.of(userInboxPage, UserInboxDTO.class);
    }

    private void saveNoticeListToInbox(List<PublicNotice> notices, Long userId) {
        List<UserInbox> list = new ArrayList<>(notices.size());
        for (PublicNotice notice : notices) {
            UserInbox box = new UserInbox();
            box.setTitle(notice.getTitle());
            box.setContent(notice.getContent());
            box.setUserId(userId);
            box.setType(notice.getType());
            box.setPushTime(notice.getPushTime());
            box.setExpireTime(notice.getExpireTime());
            list.add(box);
        }
        saveBatch(list);
    }

    @Override
    public Long sentMessageToUser(UserInboxFormDTO userInboxFormDTO) {
        return sentMessageToUser(UserContext.getUser(), userInboxFormDTO);
    }

    @Override
    public Long sentMessageToUser(Long operatorUserId, UserInboxFormDTO userInboxFormDTO) {
        LocalDateTime pushTime = LocalDateTime.now();
        LocalDateTime expireTime = pushTime.plusMonths(properties.getMessageTtlMonths());
        UserInbox inbox = new UserInbox();
        inbox.setUserId(userInboxFormDTO.getUserId());
        inbox.setTitle(userInboxFormDTO.getTitle());
        inbox.setContent(userInboxFormDTO.getContent());
        inbox.setType(userInboxFormDTO.getType() == null ? NoticeType.PRIVATE_MESSAGE.getValue() : userInboxFormDTO.getType());
        inbox.setPushTime(pushTime);
        inbox.setExpireTime(expireTime);
        inbox.setPublisher(operatorUserId);
        save(inbox);
        return inbox.getId();
    }

    @Override
    public void markInboxRead(Long inboxId) {
        markInboxRead(UserContext.getUser(), inboxId);
    }

    @Override
    public void markInboxRead(Long userId, Long inboxId) {
        if (userId == null || inboxId == null) {
            return;
        }
        update(Wrappers.<UserInbox>update()
                .eq("id", inboxId)
                .eq("user_id", userId)
                .set("is_read", true));
    }
}
