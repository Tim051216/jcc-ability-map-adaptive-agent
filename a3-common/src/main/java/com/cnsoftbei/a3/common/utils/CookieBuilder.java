package com.cnsoftbei.a3.common.utils;

import lombok.Data;
import lombok.experimental.Accessors;
import lombok.extern.slf4j.Slf4j;

import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

@Slf4j
@Data
@Accessors(chain = true, fluent = true)
public class CookieBuilder {
    private static final Pattern IPV4_PATTERN = Pattern.compile("^\\d{1,3}(?:\\.\\d{1,3}){3}$");
    private Charset charset = StandardCharsets.UTF_8;
    private int maxAge = -1;
    private String path = "/";
    private boolean httpOnly;
    private String name;
    private String value;
    private String domain;
    private final HttpServletRequest request;
    private final HttpServletResponse response;

    public CookieBuilder(HttpServletRequest request, HttpServletResponse response) {
        this.request = request;
        this.response = response;
    }

    /**
     * 构建cookie，会对cookie值用UTF-8做URL编码，避免中文乱码
     */
    public void build(){
        if (response == null) {
            log.error("response为null，无法写入cookie");
            return;
        }
        Cookie cookie = new Cookie(name, URLEncoder.encode(value, charset));
        if(StringUtils.isNotBlank(domain)) {
            cookie.setDomain(domain);
        }else if (request != null) {
            String serverName = request.getServerName();
            if (shouldSetDomain(serverName)) {
                serverName = StringUtils.subAfter(serverName, ".", false);
                cookie.setDomain("." + serverName);
            }
        }
        cookie.setHttpOnly(httpOnly);
        cookie.setMaxAge(maxAge);
        cookie.setPath(path);
        log.debug("生成cookie，编码方式:{}，【{}={}，domain:{};maxAge={};path={};httpOnly={}】",
                charset.name(), name, value, domain, maxAge, path, httpOnly);
        response.addCookie(cookie);
    }

    /**
     * 利用UTF-8对cookie值解码，避免中文乱码问题
     * @param cookieValue cookie原始值
     * @return 解码后的值
     */
    public String decode(String cookieValue){
        return URLDecoder.decode(cookieValue, charset);
    }

    private boolean shouldSetDomain(String serverName) {
        if (StringUtils.isBlank(serverName)) {
            return false;
        }
        if ("localhost".equalsIgnoreCase(serverName) || IPV4_PATTERN.matcher(serverName).matches()) {
            return false;
        }
        return StringUtils.contains(serverName, ".");
    }
}
