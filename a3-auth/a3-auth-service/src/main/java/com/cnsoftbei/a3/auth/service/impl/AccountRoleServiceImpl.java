package com.cnsoftbei.a3.auth.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cnsoftbei.a3.auth.domain.po.AccountRole;
import com.cnsoftbei.a3.auth.mapper.AccountRoleMapper;
import com.cnsoftbei.a3.auth.service.IAccountRoleService;
import org.springframework.stereotype.Service;

/**
 * <p>
 * 账户、角色关联表 服务实现类
 * </p>
 *
 * @author 虎哥
 * @since 2022-06-16
 */
@Service
public class AccountRoleServiceImpl extends ServiceImpl<AccountRoleMapper, AccountRole> implements IAccountRoleService {

}
