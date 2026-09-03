package com.cnsoftbei.a3.learning.controller;

import com.cnsoftbei.a3.common.domain.R;
import com.cnsoftbei.a3.learning.domain.dto.TrialFeedbackSubmitDTO;
import com.cnsoftbei.a3.learning.domain.vo.TrialFeedbackReceiptVO;
import com.cnsoftbei.a3.learning.service.ITrialFeedbackService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Api(tags = "真实用户试用反馈")
@RestController
@RequestMapping("/learning/trial-feedback")
@RequiredArgsConstructor
public class TrialFeedbackController {

    private final ITrialFeedbackService trialFeedbackService;

    @ApiOperation("提交真实用户试用反馈")
    @PostMapping
    public R<TrialFeedbackReceiptVO> submit(@Validated @RequestBody TrialFeedbackSubmitDTO dto) {
        return R.ok(TrialFeedbackReceiptVO.from(trialFeedbackService.submit(dto)));
    }

    @ApiOperation("查询当前用户的反馈回执")
    @GetMapping("/mine")
    public R<List<TrialFeedbackReceiptVO>> queryMine() {
        return R.ok(trialFeedbackService.queryMine().stream().map(TrialFeedbackReceiptVO::from).collect(java.util.stream.Collectors.toList()));
    }
}
