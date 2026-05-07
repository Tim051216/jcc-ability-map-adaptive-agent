package com.cnsoftbei.a3.user.service;

import com.cnsoftbei.a3.common.domain.dto.PageDTO;
import com.cnsoftbei.a3.user.domain.query.UserPageQuery;
import com.cnsoftbei.a3.user.domain.vo.StaffVO;

/**
 * <p>
 * 员工详情表 服务类
 * </p>
 *
 * @author 虎哥
 * @since 2022-07-12
 */
public interface IStaffService {
    PageDTO<StaffVO> queryStaffPage(UserPageQuery pageQuery);
}
