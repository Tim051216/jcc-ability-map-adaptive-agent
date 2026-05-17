package com.cnsoftbei.a3.learning.domain.dto;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import javax.validation.constraints.NotNull;
import java.time.LocalDateTime;

@Data
@ApiModel(description = "学习章节定位写回")
public class LearningSectionPositionFormDTO {

    @ApiModelProperty("课表id")
    @NotNull(message = "课表id不能为空")
    private Long lessonId;

    @ApiModelProperty("对应节的id")
    @NotNull(message = "节的id不能为空")
    private Long sectionId;

    @ApiModelProperty("提交时间")
    private LocalDateTime commitTime;
}
