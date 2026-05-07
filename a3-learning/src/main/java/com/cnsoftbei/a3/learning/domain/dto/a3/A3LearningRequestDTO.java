package com.cnsoftbei.a3.learning.domain.dto.a3;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import java.util.List;

@Data
@ApiModel("A3赛题学习请求")
public class A3LearningRequestDTO {

    @NotBlank
    @ApiModelProperty("学生姓名")
    private String studentName;

    @NotBlank
    @ApiModelProperty("专业方向")
    private String major;

    @NotBlank
    @ApiModelProperty("目标课程")
    private String courseName;

    @NotBlank
    @ApiModelProperty("学习目标")
    private String learningGoal;

    @ApiModelProperty("近期对话内容")
    private String recentDialogue;

    @ApiModelProperty("知识短板")
    private List<String> weakPoints;

    @ApiModelProperty("偏好资源形式")
    private List<String> preferredResourceTypes;

    @Min(1)
    @ApiModelProperty("每周可投入学习时长，单位小时")
    private Integer availableHoursPerWeek;
}
