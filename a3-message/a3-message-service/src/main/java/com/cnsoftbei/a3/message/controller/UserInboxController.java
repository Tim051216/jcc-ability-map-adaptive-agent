package com.cnsoftbei.a3.message.controller;

import com.cnsoftbei.a3.common.domain.dto.PageDTO;
import com.cnsoftbei.a3.common.utils.UserContext;
import com.cnsoftbei.a3.message.domain.dto.UserInboxDTO;
import com.cnsoftbei.a3.message.domain.dto.UserInboxFormDTO;
import com.cnsoftbei.a3.message.domain.query.UserInboxQuery;
import com.cnsoftbei.a3.message.service.IUserInboxService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.RequiredArgsConstructor;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;

@Api(tags = "学习通知收件箱接口")
@RestController
@RequestMapping("/inboxes")
@RequiredArgsConstructor
public class UserInboxController {

    private final IUserInboxService inboxService;

    @PostMapping
    @ApiOperation("发送站内消息")
    public Long sentMessageToUser(@RequestBody UserInboxFormDTO userInboxFormDTO, HttpServletRequest request) {
        Long userId = bindUserFromHeader(request);
        try {
            return inboxService.sentMessageToUser(userId, userInboxFormDTO);
        } finally {
            UserContext.removeUser();
        }
    }

    @ApiOperation("分页查询当前用户站内通知")
    @GetMapping
    public PageDTO<UserInboxDTO> queryUserInBoxesPage(UserInboxQuery query, HttpServletRequest request) {
        Long userId = bindUserFromHeader(request);
        try {
            return inboxService.queryUserInBoxesPage(userId, query);
        } finally {
            UserContext.removeUser();
        }
    }

    @PutMapping("/{id}/read")
    @ApiOperation("标记站内通知已读")
    public void markInboxRead(@PathVariable("id") Long id, HttpServletRequest request) {
        Long userId = bindUserFromHeader(request);
        try {
            inboxService.markInboxRead(userId, id);
        } finally {
            UserContext.removeUser();
        }
    }

    private Long bindUserFromHeader(HttpServletRequest request) {
        String userInfo = request.getHeader("user-info");
        if (!StringUtils.hasText(userInfo)) {
            return null;
        }
        try {
            Long userId = Long.parseLong(userInfo.trim());
            UserContext.setUser(userId);
            return userId;
        } catch (NumberFormatException ignored) {
            UserContext.removeUser();
            return null;
        }
    }
}
