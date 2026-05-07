package com.cnsoftbei.a3.authsdk.resource.interceptors;

import com.cnsoftbei.a3.auth.common.constants.JwtConstants;
import com.cnsoftbei.a3.common.utils.UserContext;
import feign.RequestInterceptor;
import feign.RequestTemplate;

public class FeignRelayUserInterceptor implements RequestInterceptor {
    @Override
    public void apply(RequestTemplate template) {
        Long userId = UserContext.getUser();
        if (userId == null) {
            return;
        }
        template.header(JwtConstants.USER_HEADER, userId.toString());
    }
}
