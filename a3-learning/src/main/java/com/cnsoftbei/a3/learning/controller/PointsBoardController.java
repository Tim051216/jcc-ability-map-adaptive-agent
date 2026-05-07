package com.cnsoftbei.a3.learning.controller;


import com.cnsoftbei.a3.common.utils.BeanUtils;
import com.cnsoftbei.a3.common.utils.CollUtils;
import com.cnsoftbei.a3.learning.domain.po.PointsBoardSeason;
import com.cnsoftbei.a3.learning.domain.query.PointsBoardQuery;
import com.cnsoftbei.a3.learning.domain.vo.PointsBoardSeasonVO;
import com.cnsoftbei.a3.learning.domain.vo.PointsBoardVO;
import com.cnsoftbei.a3.learning.service.IPointsBoardSeasonService;
import com.cnsoftbei.a3.learning.service.IPointsBoardService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

/**
 * <p>
 * 学霸天梯榜 前端控制器
 * </p>
 *
 * @author fenny
 * @since 2023-11-29
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/boards")
@Api(tags = "A3学习激励评估接口")
public class PointsBoardController {

    private final IPointsBoardSeasonService seasonService;
    private final IPointsBoardService pointsBoardService;
    @ApiOperation("查询赛季信息列表")
    @GetMapping("/seasons/list")
    public List<PointsBoardSeasonVO> queryPointsBoardSeasons(){
        List<PointsBoardSeason> list = seasonService.lambdaQuery().lt(PointsBoardSeason::getBeginTime, LocalDateTime.now()).list();
        if(CollUtils.isEmpty(list)){
            return CollUtils.emptyList();
        }
        return BeanUtils.copyList(list, PointsBoardSeasonVO.class);
    }

    @GetMapping
    @ApiOperation("查询赛季积分榜")
    public PointsBoardVO queryPointsBoardBySeason(PointsBoardQuery query){
        return pointsBoardService.queryPointsBoardBySeason(query);
    }
}
