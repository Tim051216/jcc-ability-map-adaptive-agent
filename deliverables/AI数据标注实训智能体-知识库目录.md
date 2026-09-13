# AI 数据标注实训智能体候选知识库目录（K001-K060）

> 目录状态：全部为 candidate。平台字段、取值、必填性、阈值和导出约束均待教师核验；S1-S3 为候选来源/格式参考，S4 为待补的本校平台与教师核验材料。

来源编号说明：S1＝《数据标注职业技能等级标准（2021 年 1.0 版）》候选定位；S2＝《人工智能训练师国家职业技能标准（2021 年版）》候选定位；S3＝Microsoft COCO Dataset Data Format 官方格式参考；S4＝学校标注平台 schema、课程实训手册或教师核验记录（待补）。以上来源均不替代教师核验，也不构成对平台字段规则的确认。

## K001 先明确标注任务目标

- id：K001
- title：先明确标注任务目标
- content：开始标注前先写清输入图像、目标类别、标注产物、验收人和交付时点；不因一句口号直接画框。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S2
- sourceLocator：PDF p.10（印刷页6），3.1 数据标注（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：任务目标、输入、输出、验收
- reviewStatus：candidate

## K002 识别任务类型

- id：K002
- title：识别任务类型
- content：先区分目标检测框、实例分割、多边形、关键点或分类任务，再选择相应工具和字段；不把一种任务的规则套到另一种任务。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S1
- sourceLocator：PDF p.8、p.11，图像标注与质量要求（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：任务类型、目标检测、实例分割、关键点
- reviewStatus：candidate

## K003 确认类别清单

- id：K003
- title：确认类别清单
- content：读取本批次类别表并确认名称、同义词和禁用类别；无法确认时先向教师或质检员提问，不自行新增类别。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S4
- sourceLocator：待教师提供：学校标注平台 schema/课程实训手册/核验记录（字段、取值、必填性、阈值）
- keywords：类别表、标签、同义词、禁用类别
- reviewStatus：candidate

## K004 界定标注对象

- id：K004
- title：界定标注对象
- content：把‘什么算一个目标’写成可观察描述，区分实体、部件、背景和装饰图案；边界模糊时记录疑点。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S2
- sourceLocator：PDF p.10、p.12，数据标注工种与审核能力（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：标注对象、实例定义、背景、部件
- reviewStatus：candidate

## K005 确认正样本与忽略范围

- id：K005
- title：确认正样本与忽略范围
- content：核对是否只标正样本、是否存在忽略区域或无关类别；忽略区域的标记方式必须以本批次说明为准。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S4
- sourceLocator：待教师提供：学校标注平台 schema/课程实训手册/核验记录（字段、取值、必填性、阈值）
- keywords：正样本、忽略区域、无关类别、批次说明
- reviewStatus：candidate

## K006 先检查图像是否可用

- id：K006
- title：先检查图像是否可用
- content：标注前检查图像能否完整打开、方向是否正常、分辨率是否足以辨认目标；模糊、损坏或重复图像先登记，不勉强标注。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S1
- sourceLocator：PDF p.8，2.2.1 图像 2D 拉框（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：图像检查、损坏、方向、分辨率
- reviewStatus：candidate

## K007 区分遮挡、截断与粘连

- id：K007
- title：区分遮挡、截断与粘连
- content：将‘被其他物体挡住’、‘越出图像边界’和‘同类实例靠得很近’分开描述；同时出现多种情况时逐项记录。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S4
- sourceLocator：待教师提供：本校批次流程、复核表与升级路径（核验前仅作候选）
- keywords：遮挡、截断、粘连、现象判断
- reviewStatus：candidate

## K008 用澄清问题补足上下文

- id：K008
- title：用澄清问题补足上下文
- content：遇到‘这个怎么框’等模糊请求，至少追问任务类型、目标类别、是否出边界、是否被遮挡和期望输出格式。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S2
- sourceLocator：PDF p.10（印刷页6），3.1 数据标注（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：澄清、上下文、追问、期望输出
- reviewStatus：candidate

## K009 记录不确定性与依据

- id：K009
- title：记录不确定性与依据
- content：对看不清、类别不确定或边界存在争议的实例，记录观察证据和待确认问题，不用猜测替代证据。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S2
- sourceLocator：PDF p.12（印刷页8），3.2 数据标注准确性/完整性审核（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：不确定性、证据、争议、备注
- reviewStatus：candidate

## K010 管理批次与版本

- id：K010
- title：管理批次与版本
- content：在开始和提交时记录批次号、图像标识、规则版本和操作者角色，规则变更后重新检查受影响样本。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S4
- sourceLocator：待教师提供：本校批次流程、复核表与升级路径（核验前仅作候选）
- keywords：批次、版本、图像标识、变更
- reviewStatus：candidate

## K011 理解 bbox 坐标原点

- id：K011
- title：理解 bbox 坐标原点
- content：采用数据格式时先确认坐标原点和轴方向；COCO 目标检测格式以图像左上角为原点并使用 0-indexed 坐标。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S3
- sourceLocator：COCO Data Format 官方页：object detection annotation.bbox（[x,y,width,height]）
- keywords：bbox、坐标原点、左上角、0-indexed
- reviewStatus：candidate

## K012 理解 [x,y,width,height]

- id：K012
- title：理解 [x,y,width,height]
- content：在 COCO 参考结构中，bbox 的 x、y 表示左上角，width、height 表示框的宽和高；不要误当成右下角坐标。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S3
- sourceLocator：COCO Data Format 官方页：object detection annotation.bbox（[x,y,width,height]）
- keywords：x、y、width、height、右下角
- reviewStatus：candidate

## K013 从左上到右下拖框

- id：K013
- title：从左上到右下拖框
- content：框选时先定位目标左上边界，再拖到右下边界，松开后检查四条边是否贴合目标可见轮廓。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S1
- sourceLocator：PDF p.8，2.2.1 图像 2D 拉框（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：拖框、左上、右下、四条边
- reviewStatus：candidate

## K014 保持框紧致且不加背景

- id：K014
- title：保持框紧致且不加背景
- content：框应覆盖目标的可观察范围，尽量不带入道路、墙面或其他背景；不要为追求整齐而留出大块空白。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S1
- sourceLocator：PDF p.8，2.2.1 图像 2D 拉框（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：紧致框、背景、空白、边界
- reviewStatus：candidate

## K015 核对坐标精度

- id：K015
- title：核对坐标精度
- content：提交前检查坐标是否为平台允许的数值类型和精度；不要擅自四舍五入或截断小数，除非批次说明明确要求。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S4
- sourceLocator：待教师提供：学校标注平台 schema/课程实训手册/核验记录（字段、取值、必填性、阈值）
- keywords：坐标精度、小数、四舍五入、数值类型
- reviewStatus：candidate

## K016 检查框与图像边界

- id：K016
- title：检查框与图像边界
- content：框的几何范围不能凭视觉越出图像画布；遇到贴边目标先确认平台对边界坐标的表示方式，再保存。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S3
- sourceLocator：COCO Data Format 官方页：object detection annotation.bbox（[x,y,width,height]）
- keywords：图像边界、贴边、画布、越界
- reviewStatus：candidate

## K017 谨慎处理小目标

- id：K017
- title：谨慎处理小目标
- content：放大查看小目标后再框选，并记录是否仍可辨认；最小像素尺寸、最小框面积和是否忽略必须按批次要求确认。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S4
- sourceLocator：待教师提供：学校标注平台 schema/课程实训手册/核验记录（字段、取值、必填性、阈值）
- keywords：小目标、放大、最小尺寸、可辨认
- reviewStatus：candidate

## K018 避免用固定比例扩框

- id：K018
- title：避免用固定比例扩框
- content：不同目标形状不能套用统一外扩比例；以可观察边缘为依据逐个调整，避免把阴影、反光或接触物纳入。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S1
- sourceLocator：PDF p.8，2.2.1 图像 2D 拉框（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：外扩、比例、阴影、反光
- reviewStatus：candidate

## K019 核对面积与尺寸关系

- id：K019
- title：核对面积与尺寸关系
- content：若数据结构包含 area，应检查它与 bbox 尺寸或任务要求的关系；不要把 bbox 面积误写成分割区域面积。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S3
- sourceLocator：COCO Data Format 官方页：annotation.id/image_id/category_id/segmentation/area/bbox/iscrowd
- keywords：area、面积、bbox 面积、分割区域
- reviewStatus：candidate

## K020 检查坐标顺序与正值

- id：K020
- title：检查坐标顺序与正值
- content：逐项确认字段顺序、宽高方向和数值范围，避免把 [x1,y1,x2,y2] 与 [x,y,w,h] 混用。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S3
- sourceLocator：COCO Data Format 官方页：object detection annotation.bbox（[x,y,width,height]）
- keywords：坐标顺序、x1、y1、x2、w,h
- reviewStatus：candidate

## K021 处理缩放后的坐标

- id：K021
- title：处理缩放后的坐标
- content：图像缩放、旋转或裁剪后，先确认标注工具是否自动换算；必要时按原图尺寸复核，不能直接抄用预览坐标。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S4
- sourceLocator：待教师提供：学校标注平台 schema/课程实训手册/核验记录（字段、取值、必填性、阈值）
- keywords：缩放、旋转、裁剪、原图尺寸
- reviewStatus：candidate

## K022 用平移和放大复核边缘

- id：K022
- title：用平移和放大复核边缘
- content：对细小或贴边目标采用局部放大、平移和回看全图的顺序，避免视窗移动导致框偏移或漏掉邻近实例。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S1
- sourceLocator：PDF p.8，2.2.1 图像 2D 拉框（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：平移、放大、边缘复核、漏标
- reviewStatus：candidate

## K023 排查重复框与重叠框

- id：K023
- title：排查重复框与重叠框
- content：提交前按类别和位置检查是否误画重复框；重叠本身不等于错误，需结合实例数量和遮挡关系判断。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S2
- sourceLocator：PDF p.12（印刷页8），3.2 数据标注准确性/完整性审核（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：重复框、重叠框、实例数量、复核
- reviewStatus：candidate

## K024 处理负坐标或越界输入

- id：K024
- title：处理负坐标或越界输入
- content：发现导入数据出现负坐标、负宽高或超出图像尺寸时先暂停提交，保留原始记录并请教师确认修正策略。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S4
- sourceLocator：待教师提供：学校标注平台 schema/课程实训手册/核验记录（字段、取值、必填性、阈值）
- keywords：负坐标、负宽高、越界输入、暂停提交
- reviewStatus：candidate

## K025 核对导出字段与实例标识

- id：K025
- title：核对导出字段与实例标识
- content：导出前检查 image_id、category_id、bbox 等字段是否对应同一图像和实例；字段缺失或重复时先回到质检，不直接交付。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S3
- sourceLocator：COCO Data Format 官方页：annotation.id/image_id/category_id/segmentation/area/bbox/iscrowd
- keywords：导出、image_id、category_id、实例标识
- reviewStatus：candidate

## K026 区分遮挡与截断

- id：K026
- title：区分遮挡与截断
- content：目标被车、树或人挡住属于遮挡；目标本体越出图像边缘属于截断；两者同时出现时分别记录。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S4
- sourceLocator：待教师提供：本校批次流程、复核表与升级路径（核验前仅作候选）
- keywords：遮挡、截断、挡住、出边界
- reviewStatus：candidate

## K027 遮挡目标沿可见轮廓框选

- id：K027
- title：遮挡目标沿可见轮廓框选
- content：目标仍可辨认时，沿可见目标边界画紧致矩形，不凭想象把被遮住部分扩进框内。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S1
- sourceLocator：PDF p.8、p.11，图像标注与质量要求（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：可见轮廓、紧致矩形、被遮住、补全
- reviewStatus：candidate

## K028 谨慎填写遮挡属性

- id：K028
- title：谨慎填写遮挡属性
- content：若平台提供遮挡属性，可在确认目标仍可辨认后按批次规则填写；常见字段名可能是 occluded，但名称、取值和必填性不能自行假定。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S4
- sourceLocator：待教师提供：学校标注平台 schema/课程实训手册/核验记录（字段、取值、必填性、阈值）
- keywords：occluded、遮挡属性、字段名、必填性
- reviewStatus：candidate

## K029 同类遮挡仍按实例分开

- id：K029
- title：同类遮挡仍按实例分开
- content：一个同类目标挡住另一个目标时，先判断是否能分别辨认，再为可确认的实例分别保留框，不合并成大框。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S2
- sourceLocator：PDF p.12（印刷页8），3.2 数据标注准确性/完整性审核（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：同类遮挡、分别辨认、分开、大框
- reviewStatus：candidate

## K030 异类遮挡不纳入目标框

- id：K030
- title：异类遮挡不纳入目标框
- content：目标被不同类别物体遮挡时，遮挡物不是目标组成部分；框选应避免把遮挡物整体纳入。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S1
- sourceLocator：PDF p.8，2.2.1 图像 2D 拉框（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：异类遮挡、遮挡物、目标组成、纳入
- reviewStatus：candidate

## K031 重度遮挡先判断可辨认性

- id：K031
- title：重度遮挡先判断可辨认性
- content：只露出少量局部时，结合类别线索和上下文判断是否仍能可靠确认；无法确认就标记为待复核，不强行猜类别。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S2
- sourceLocator：PDF p.12（印刷页8），3.2 数据标注准确性/完整性审核（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：重度遮挡、局部、可辨认性、待复核
- reviewStatus：candidate

## K032 完全遮挡不凭空补框

- id：K032
- title：完全遮挡不凭空补框
- content：目标完全不可见且没有足够证据确认时，不凭想象绘制完整框；将疑点提交质检或教师处理。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S1
- sourceLocator：PDF p.8、p.11，图像标注与质量要求（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：完全遮挡、不可见、补框、质检
- reviewStatus：candidate

## K033 多个遮挡物逐层检查

- id：K033
- title：多个遮挡物逐层检查
- content：面对多个遮挡物，先找目标可见证据，再确认框边界是否混入任何遮挡物；不要因遮挡层数多而直接合并。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S1
- sourceLocator：PDF p.8，2.2.1 图像 2D 拉框（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：多个遮挡物、逐层、可见证据、合并
- reviewStatus：candidate

## K034 遮挡场景检查实例数量

- id：K034
- title：遮挡场景检查实例数量
- content：保存前数清可辨认实例，并逐一核对类别、位置和框；遮挡不能成为漏标或重复标的理由。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S2
- sourceLocator：PDF p.12（印刷页8），3.2 数据标注准确性/完整性审核（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：实例数量、漏标、重复标、遮挡复核
- reviewStatus：candidate

## K035 区分 bbox 与分割遮挡表达

- id：K035
- title：区分 bbox 与分割遮挡表达
- content：目标检测只需按任务要求给出框；实例分割还需遵循对应掩码或多边形规则，不能用 bbox 代替分割标注。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S3
- sourceLocator：COCO Data Format 官方页：遮挡示例与 segmentation 说明；不定义 occluded/truncated
- keywords：bbox、分割、掩码、多边形
- reviewStatus：candidate

## K036 保持整批遮挡规则一致

- id：K036
- title：保持整批遮挡规则一致
- content：同一批次对相似遮挡程度应采用同一判断逻辑；发现前后不一致时暂停扩标并请求统一示例或教师裁决。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S2
- sourceLocator：PDF p.12（印刷页8），3.2 数据标注准确性/完整性审核（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：批次一致、遮挡规则、示例、裁决
- reviewStatus：candidate

## K037 识别图像边界截断

- id：K037
- title：识别图像边界截断
- content：目标本体被图像四边裁掉，且裁切来自取景范围而非遮挡物时，记录为截断候选情形。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S4
- sourceLocator：待教师提供：本校批次流程、复核表与升级路径（核验前仅作候选）
- keywords：截断、图像边界、四边、取景
- reviewStatus：candidate

## K038 区分贴边与真正截断

- id：K038
- title：区分贴边与真正截断
- content：目标完整可见但恰好贴近边缘，不应仅因接触边界就推断截断；应检查是否有部分本体消失。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S4
- sourceLocator：待教师提供：本校批次流程、复核表与升级路径（核验前仅作候选）
- keywords：贴边、完整可见、本体消失、边缘
- reviewStatus：candidate

## K039 截断框贴合可见边界

- id：K039
- title：截断框贴合可见边界
- content：目标越出画面时，框覆盖可见部分并贴合图像边缘；不得把框画到画布之外，也不凭想象补出画外区域。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S3
- sourceLocator：COCO Data Format 官方页：object detection annotation.bbox（[x,y,width,height]）
- keywords：截断框、可见部分、画布之外、补全
- reviewStatus：candidate

## K040 谨慎填写截断属性

- id：K040
- title：谨慎填写截断属性
- content：若平台有截断属性，可按教师核验后的规则填写；常见字段名可能是 truncated，但 COCO 格式本身不定义该字段。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S3
- sourceLocator：COCO Data Format 官方页：遮挡示例与 segmentation 说明；不定义 occluded/truncated
- keywords：truncated、截断属性、COCO、字段
- reviewStatus：candidate

## K041 记录单侧与多侧截断

- id：K041
- title：记录单侧与多侧截断
- content：分别观察左、右、上、下边界，记录目标是单侧还是多侧出画面；分类取值和备注方式交由平台规则确认。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S4
- sourceLocator：待教师提供：学校标注平台 schema/课程实训手册/核验记录（字段、取值、必填性、阈值）
- keywords：单侧截断、多侧截断、左边界、右边界
- reviewStatus：candidate

## K042 截断小片段先做可辨认性判断

- id：K042
- title：截断小片段先做可辨认性判断
- content：只剩很小可见片段时，先判断类别和实例是否可靠可确认；若证据不足，提交待复核而不是随意画框。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S2
- sourceLocator：PDF p.12（印刷页8），3.2 数据标注准确性/完整性审核（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：小片段、可辨认、证据不足、待复核
- reviewStatus：candidate

## K043 区分裁剪操作与原始截断

- id：K043
- title：区分裁剪操作与原始截断
- content：若图像由后处理裁剪得到，先确认任务要求是按当前图像标注还是追溯原始图像；不要把两个坐标空间混在一起。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S4
- sourceLocator：待教师提供：学校标注平台 schema/课程实训手册/核验记录（字段、取值、必填性、阈值）
- keywords：裁剪、原始图像、坐标空间、后处理
- reviewStatus：candidate

## K044 复核边界像素与坐标范围

- id：K044
- title：复核边界像素与坐标范围
- content：对贴边框检查左上坐标、宽高和右下范围是否符合图像尺寸；边界是否允许等于宽或高等细节必须看平台 schema。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S3
- sourceLocator：COCO Data Format 官方页：object detection annotation.bbox（[x,y,width,height]）
- keywords：边界像素、图像尺寸、右下范围、宽高
- reviewStatus：candidate

## K045 保持截断判定的批次一致性

- id：K045
- title：保持截断判定的批次一致性
- content：用同一批次的正反例对照检查截断标签和框边界，遇到临界样本集中提交教师确认，避免个人标准漂移。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S2
- sourceLocator：PDF p.12（印刷页8），3.2 数据标注准确性/完整性审核（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：截断一致性、正反例、临界样本、标准漂移
- reviewStatus：candidate

## K046 独立实例分别计数

- id：K046
- title：独立实例分别计数
- content：同一类别中能独立辨认的每个实体都应单独计数、单独检查和单独关联类别，不因类别相同而只留一个框。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S2
- sourceLocator：PDF p.12（印刷页8），3.2 数据标注准确性/完整性审核（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：同类实例、独立计数、分别标框、类别相同
- reviewStatus：candidate

## K047 处理相互接触的实例

- id：K047
- title：处理相互接触的实例
- content：两个同类目标相互接触时，沿各自可见边界寻找分界证据；不能用一个覆盖两者的大框替代实例框。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S1
- sourceLocator：PDF p.8，2.2.1 图像 2D 拉框（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：接触、分界、大框、同类目标
- reviewStatus：candidate

## K048 处理重叠的同类实例

- id：K048
- title：处理重叠的同类实例
- content：同类实例发生重叠时，先利用可见轮廓、遮挡关系和位置关系拆分；看不清分界就升级质检，不强行猜边界。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S2
- sourceLocator：PDF p.12（印刷页8），3.2 数据标注准确性/完整性审核（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：重叠、同类、可见轮廓、升级质检
- reviewStatus：candidate

## K049 检查嵌套与包含关系

- id：K049
- title：检查嵌套与包含关系
- content：一个目标位于另一个目标内部时，按类别表和任务定义判断是否是两个实例；不得仅凭框的包含关系自动合并或删除。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S4
- sourceLocator：待教师提供：学校标注平台 schema/课程实训手册/核验记录（字段、取值、必填性、阈值）
- keywords：嵌套、包含、两个实例、合并
- reviewStatus：candidate

## K050 识别群体与 iscrowd 语义

- id：K050
- title：识别群体与 iscrowd 语义
- content：COCO 参考格式用 iscrowd 区分实例与群体标注情形；本校是否采用该字段、如何定义群体必须由教师核验。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S3
- sourceLocator：COCO Data Format 官方页：iscrowd 与实例/群体标注说明
- keywords：iscrowd、群体、实例、COCO
- reviewStatus：candidate

## K051 排查同一实例的重复框

- id：K051
- title：排查同一实例的重复框
- content：按类别、中心位置和轮廓逐项比对，确认一个实例不会因重复点击、复制或导入而出现多个近似框。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S2
- sourceLocator：PDF p.12（印刷页8），3.2 数据标注准确性/完整性审核（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：重复框、重复实例、中心位置、导入
- reviewStatus：candidate

## K052 模糊分界采用升级机制

- id：K052
- title：模糊分界采用升级机制
- content：同类目标无法可靠分开时保留图像证据、临时标记和问题描述，交由指定质检角色裁决，不以个人猜测结束。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S2
- sourceLocator：PDF p.12（印刷页8），3.2 数据标注准确性/完整性审核（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：模糊分界、升级、质检角色、问题描述
- reviewStatus：candidate

## K053 核对实例与类别标识映射

- id：K053
- title：核对实例与类别标识映射
- content：导出前确认每个实例标识只指向一张图像中的一个目标，category_id 与类别表一致；编号生成和重用规则待平台核验。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S3
- sourceLocator：COCO Data Format 官方页：annotation.id/image_id/category_id/segmentation/area/bbox/iscrowd
- keywords：实例 ID、category_id、映射、编号
- reviewStatus：candidate

## K054 完整性检查

- id：K054
- title：完整性检查
- content：按图像清单逐张检查应标目标是否都有记录，并核对遮挡、截断和小目标是否被遗漏；抽样比例和通过线待教师确认。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S2
- sourceLocator：PDF p.12（印刷页8），3.2 数据标注准确性/完整性审核（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：完整性、漏标、图像清单、抽样
- reviewStatus：candidate

## K055 准确性与类别检查

- id：K055
- title：准确性与类别检查
- content：复核类别名称、实例对应关系和明显误标，优先处理高影响错误；合格率计算口径和阈值不能自行引用为平台标准。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S1
- sourceLocator：PDF p.11，2.3.1 标注任务质检/审核（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：准确性、误标、类别检查、合格率
- reviewStatus：candidate

## K056 几何质量检查

- id：K056
- title：几何质量检查
- content：检查 bbox 是否紧致、方向正确、无负宽高、无重复框和不必要背景，并与图像尺寸及导出结构互相印证。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S3
- sourceLocator：COCO Data Format 官方页：object detection annotation.bbox（[x,y,width,height]）
- keywords：几何质量、紧致、负宽高、导出结构
- reviewStatus：candidate

## K057 保持标注员之间的一致性

- id：K057
- title：保持标注员之间的一致性
- content：多人协作时使用同一版类别表和示例，定期对边界、遮挡和实例拆分争议进行对齐；一致性指标和计算方法待教师核验。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S2
- sourceLocator：PDF p.12（印刷页8），3.2 数据标注准确性/完整性审核（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：一致性、多人协作、示例、对齐
- reviewStatus：candidate

## K058 抽样、返工与闭环

- id：K058
- title：抽样、返工与闭环
- content：质检发现问题后记录问题类型、原框、修订框和复核结果，回看同批次相似样本，形成发现—修订—再抽样闭环。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S1
- sourceLocator：PDF p.11，2.3.1 标注任务质检/审核（候选定位；仅作岗位范围参考，页码以持有版本为准）
- keywords：抽样、返工、复核、闭环
- reviewStatus：candidate

## K059 隐私与数据最小化

- id：K059
- title：隐私与数据最小化
- content：只使用完成实训所必需的图像和字段；涉及人脸、车牌、账号或其他敏感信息时先按教师指引脱敏、限权和留痕，不把真实隐私写入示例。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S4
- sourceLocator：待教师提供：本校批次流程、复核表与升级路径（核验前仅作候选）
- keywords：隐私、敏感信息、脱敏、最小化
- reviewStatus：candidate

## K060 来源、权限与异常上报

- id：K060
- title：来源、权限与异常上报
- content：交付前记录数据来源、授权范围、规则版本和处理角色；发现疑似越权、泄露、恶意样本或来源不明文件时立即停止共享并上报教师。 平台字段、取值、必填性、阈值与导出约束均待教师核验。
- sourceId：S4
- sourceLocator：待教师提供：本校批次流程、复核表与升级路径（核验前仅作候选）
- keywords：来源、授权、权限、异常上报
- reviewStatus：candidate


