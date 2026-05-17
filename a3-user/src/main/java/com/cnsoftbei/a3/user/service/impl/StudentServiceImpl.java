package com.cnsoftbei.a3.user.service.impl;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cnsoftbei.a3.api.client.trade.TradeClient;
import com.cnsoftbei.a3.common.domain.dto.PageDTO;
import com.cnsoftbei.a3.common.enums.UserType;
import com.cnsoftbei.a3.common.utils.BeanUtils;
import com.cnsoftbei.a3.common.utils.CollUtils;
import com.cnsoftbei.a3.common.utils.RandomUtils;
import com.cnsoftbei.a3.user.constants.UserConstants;
import com.cnsoftbei.a3.user.domain.dto.StudentFormDTO;
import com.cnsoftbei.a3.user.domain.po.User;
import com.cnsoftbei.a3.user.domain.po.UserDetail;
import com.cnsoftbei.a3.user.domain.query.UserPageQuery;
import com.cnsoftbei.a3.user.domain.vo.StudentPageVo;
import com.cnsoftbei.a3.user.service.IStudentService;
import com.cnsoftbei.a3.user.service.IUserDetailService;
import com.cnsoftbei.a3.user.service.IUserService;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * <p>
 * 学员详情表 服务实现类
 * </p>
 *
 * @author 虎哥
 * @since 2022-07-12
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class StudentServiceImpl implements IStudentService {

    private final IUserService userService;
    private final IUserDetailService detailService;
    private final TradeClient tradeClient;

    @Override
    @Transactional
    public void saveStudent(StudentFormDTO studentFormDTO) {
        // 1.新增用户账号
        User user = new User();
        user.setCellPhone(studentFormDTO.getCellPhone());
        user.setPassword(studentFormDTO.getPassword());
        user.setType(UserType.STUDENT);
        userService.addUserByPhone(user, studentFormDTO.getCode());

        // 2.新增学员详情
        UserDetail student = new UserDetail();
        student.setId(user.getId());
        student.setName(RandomUtils.randomString(8));
        student.setRoleId(UserConstants.STUDENT_ROLE_ID);
        detailService.save(student);
    }

    @Override
    public void updateMyPassword(StudentFormDTO studentFormDTO) {
        userService.updatePasswordByPhone(
                studentFormDTO.getCellPhone(), studentFormDTO.getCode(), studentFormDTO.getPassword()
        );
    }

    @Override
    public PageDTO<StudentPageVo> queryStudentPage(UserPageQuery query) {
        // 1.分页条件
        Page<UserDetail> page  =  detailService.queryUserDetailByPage(query, UserType.STUDENT);
        List<UserDetail> records = page.getRecords();
        if (CollUtils.isEmpty(records)) {
            return PageDTO.empty(page);
        }

        // 2.查询购买的课程数量
        List<Long> stuIds = records.stream().map(UserDetail::getId).collect(Collectors.toList());
        Map<Long, Integer> numMap = new java.util.HashMap<>();
        try {
            numMap = tradeClient.countEnrollCourseOfStudent(stuIds);
        } catch (Exception e) {
            log.warn("查询学生报名课程数量失败，降级返回基础学生信息, studentIds={}", stuIds, e);
        }

        // 3.处理vo
        List<StudentPageVo> list = new ArrayList<>(records.size());
        for (UserDetail r : records) {
            StudentPageVo v = BeanUtils.toBean(r, StudentPageVo.class);
            list.add(v);
            v.setCourseAmount(numMap.getOrDefault(r.getId(), 0));
        }
        return new PageDTO<>(page.getTotal(), page.getPages(), list);
    }
}
