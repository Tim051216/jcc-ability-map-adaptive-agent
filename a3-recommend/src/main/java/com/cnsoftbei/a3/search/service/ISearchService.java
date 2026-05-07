package com.cnsoftbei.a3.search.service;

import com.cnsoftbei.a3.common.domain.dto.PageDTO;
import com.cnsoftbei.a3.search.domain.query.CoursePageQuery;
import com.cnsoftbei.a3.search.domain.vo.CourseVO;

import java.util.List;

public interface ISearchService {

    List<CourseVO> queryCourseByCateId(Long cateLv2Id);

    List<CourseVO> queryBestTopN();

    List<CourseVO> queryNewTopN();

    List<CourseVO> queryFreeTopN();

    PageDTO<CourseVO> queryCoursesForPortal(CoursePageQuery query);

    List<Long> queryCoursesIdByName(String keyword);
}
