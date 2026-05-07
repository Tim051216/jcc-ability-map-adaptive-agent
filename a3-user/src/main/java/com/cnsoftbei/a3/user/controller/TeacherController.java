package com.cnsoftbei.a3.user.controller;


import com.cnsoftbei.a3.common.domain.dto.PageDTO;
import com.cnsoftbei.a3.user.domain.query.UserPageQuery;
import com.cnsoftbei.a3.user.domain.vo.TeacherPageVO;
import com.cnsoftbei.a3.user.service.ITeacherService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * <p>
 * 教师详情表 前端控制器
 * </p>
 *
 * @author 虎哥
 * @since 2022-07-12
 */
@RestController
@RequestMapping("/teachers")
@Api(tags = "A3导师资源管理接口")
public class TeacherController {

    @Autowired
    private ITeacherService teacherService;

    @GetMapping("/page")
    @ApiOperation("分页查询教师信息")
    public PageDTO<TeacherPageVO> queryTeacherPage(UserPageQuery pageQuery){
        return teacherService.queryTeacherPage(pageQuery);
    }
}
