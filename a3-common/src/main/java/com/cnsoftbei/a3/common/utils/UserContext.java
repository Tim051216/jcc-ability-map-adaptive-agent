package com.cnsoftbei.a3.common.utils;

import com.cnsoftbei.a3.common.exceptions.BizIllegalException;

public class UserContext {
    private static final ThreadLocal<Long> TL = new ThreadLocal<>();

    /**
     * 保存用户信息
     * @param userId 用户id
     */
    public static void setUser(Long userId){
        TL.set(userId);
    }

    /**
     * 获取用户
     * @return 用户id
     */
    public static Long getUser(){
        return TL.get();
    }

    /**
     * 获取当前登录用户 ID；未设置时抛出业务异常（网关应在请求线程写入 {@link #setUser}）。
     */
    public static Long requireUser() {
        Long userId = TL.get();
        if (userId == null) {
            throw new BizIllegalException("请先登录");
        }
        return userId;
    }

    /**
     * 移除用户信息
     */
    public static void removeUser(){
        TL.remove();
    }
}
