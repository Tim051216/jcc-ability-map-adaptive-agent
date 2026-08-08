# 软件开发岗位能力知识目录（首批核验版）

> 用途：上传星辰知识库或作为本地 RAG 入库清单。条目来源均为仓库内课程资料，来源状态为“仓库文件已校验，教师复核待完成”。本目录不冒充国家标准或教材页码。

## K001 需求目标识别
- 能力维度：requirement_analysis
- 能力单元：需求分析
- 知识点：在编码前明确用户、目标、约束和可验收结果。
- 适用场景：需求澄清、任务拆解、岗位实训启动。
- 常见错误：直接根据一句口号开始写代码。
- 学习建议：先写目标、角色、输入、输出和验收条件。
- 安全提示：涉及真实账号或个人数据时先脱敏。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_15_chapter_map.md｜第3章 软件需求分析

## K002 用户故事与用例
- 能力维度：requirement_analysis
- 能力单元：需求分析
- 知识点：用户故事描述角色、行为和价值，用例补充主成功场景与异常分支。
- 适用场景：功能需求、接口设计、验收标准编写。
- 常见错误：只写功能名，不写谁使用和何时完成。
- 学习建议：用“作为谁，我要什么，以便什么”写初稿，再补异常流程。
- 安全提示：不要把真实用户隐私写入公开需求文档。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_15_chapter_map.md｜第3章 软件需求分析

## K003 需求优先级
- 能力维度：requirement_analysis
- 能力单元：需求分析
- 知识点：按业务价值、风险、依赖和实现成本安排需求优先级。
- 适用场景：MVP、迭代计划、比赛范围控制。
- 常见错误：所有需求都标记为最高优先级。
- 学习建议：用必须、应该、可以三级划分，并记录取舍理由。
- 安全提示：高风险操作须先完成权限和审计设计。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_25_feasibility_analysis.md｜可行性分析

## K004 需求可追溯性
- 能力维度：requirement_analysis
- 能力单元：需求分析
- 知识点：需求应能追溯到设计、代码、测试和验收证据。
- 适用场景：评审、回归测试、比赛材料准备。
- 常见错误：需求修改后没有同步测试用例。
- 学习建议：为需求分配稳定编号，维护需求-接口-测试映射表。
- 安全提示：对外材料只展示脱敏样例。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_18_assessment_and_outcomes.md｜能力与毕业要求关联

## K005 可行性判断
- 能力维度：requirement_analysis
- 能力单元：需求分析
- 知识点：技术、经济、操作和法律可行性共同决定项目是否值得实施。
- 适用场景：立项、技术选型、预算评估。
- 常见错误：只证明技术能做，不评估成本与合规。
- 学习建议：为每类可行性记录证据、风险和应对措施。
- 安全提示：涉及第三方服务时核对授权和数据边界。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_25_software_engineering_core_concepts.md｜可行性分析

## K006 架构分层
- 能力维度：system_design
- 能力单元：概要设计
- 知识点：按表现层、接口层、业务层、数据层和基础设施层划分职责。
- 适用场景：系统总体设计、服务拆分、故障定位。
- 常见错误：控制器直接操作数据库并包含复杂业务逻辑。
- 学习建议：为每层定义输入输出和依赖方向。
- 安全提示：边界层统一做鉴权、校验和限流。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_26_high_level_design.md｜概要设计

## K007 模块职责
- 能力维度：system_design
- 能力单元：概要设计
- 知识点：模块应围绕单一职责组织，并通过稳定接口协作。
- 适用场景：模块划分、多人协作、代码评审。
- 常见错误：按文件数量拆模块，导致职责重复。
- 学习建议：写清每个模块负责什么、不负责什么。
- 安全提示：跨模块传输最小化数据。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_26_high_level_design.md｜概要设计

## K008 接口契约
- 能力维度：system_design
- 能力单元：概要设计
- 知识点：接口契约应明确路径、方法、参数、响应、错误和版本策略。
- 适用场景：前后端联调、服务集成、自动化测试。
- 常见错误：前端和后端各自解释同一字段。
- 学习建议：先写 JSON 示例，再实现服务逻辑。
- 安全提示：错误响应不得泄露密钥和内部堆栈。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_27_detailed_design.md｜详细设计

## K009 数据模型
- 能力维度：system_design
- 能力单元：概要设计
- 知识点：数据模型要表达实体、关系、约束、索引和生命周期。
- 适用场景：数据库设计、持久化、报表统计。
- 常见错误：只设计字段，不考虑唯一性和归属校验。
- 学习建议：先画实体关系，再确定表结构和迁移策略。
- 安全提示：个人数据字段应明确脱敏和保留期限。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_26_high_level_design.md｜概要设计

## K010 异常与回退
- 能力维度：system_design
- 能力单元：详细设计
- 知识点：模块需定义异常类型、可重试条件、降级结果和用户提示。
- 适用场景：模型不可用、网络超时、数据库故障。
- 常见错误：捕获所有异常后返回成功。
- 学习建议：为关键依赖画出失败分支并写测试。
- 安全提示：高风险动作失败时默认拒绝执行。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_27_detailed_design.md｜详细设计

## K011 事务边界
- 能力维度：system_design
- 能力单元：详细设计
- 知识点：一次业务操作中需要明确提交、回滚和幂等边界。
- 适用场景：建议保存、测评提交、订单或任务状态更新。
- 常见错误：写入多张表时部分成功。
- 学习建议：把事务范围放在服务层，并测试失败回滚。
- 安全提示：重试接口必须带幂等键或可识别记录。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_27_detailed_design.md｜详细设计

## K012 可观测性
- 能力维度：system_design
- 能力单元：部署与运维
- 知识点：日志、指标、追踪和健康检查共同支撑故障定位。
- 适用场景：本地联调、比赛演示、线上排障。
- 常见错误：只记录“失败”，不记录请求标识和耗时。
- 学习建议：为关键链路记录 trace_id、状态和耗时。
- 安全提示：日志不得写入令牌、密码和完整学生记录。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_20_bililearn_local_startup.md｜联调时推荐的检查顺序

## K013 代码可读性
- 能力维度：coding_implementation
- 能力单元：编码实现
- 知识点：命名、函数边界和注释应让代码意图易于理解。
- 适用场景：功能开发、代码评审、交接维护。
- 常见错误：用超长函数和隐含副作用堆叠流程。
- 学习建议：每个函数只做一件可描述的事。
- 安全提示：示例代码中的凭据必须使用占位符。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_06.md｜习题与答案（含自测）

## K014 数据校验
- 能力维度：coding_implementation
- 能力单元：编码实现
- 知识点：边界层校验类型、范围、长度和枚举，业务层再做归属与状态校验。
- 适用场景：FastAPI 请求、表单提交、文件上传。
- 常见错误：只在前端校验，绕过页面即可写入非法数据。
- 学习建议：为每个输入字段定义合法域和错误响应。
- 安全提示：拒绝路径穿越、脚本和未授权资源标识。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_27_detailed_design.md｜详细设计

## K015 算法复杂度
- 能力维度：coding_implementation
- 能力单元：编码实现
- 知识点：实现前估算时间和空间复杂度，避免数据规模增长后失控。
- 适用场景：搜索、排序、推荐和批量处理。
- 常见错误：在循环中重复查询数据库或远程服务。
- 学习建议：标出主要循环、集合操作和 I/O 次数。
- 安全提示：对用户可控的批量大小设置上限。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_15_chapter_map.md｜第6章 软件编程实现

## K016 数据库查询效率
- 能力维度：coding_implementation
- 能力单元：编码实现
- 知识点：查询应使用合适索引、分页和批量读取，避免 N+1 查询。
- 适用场景：学习历史、资源列表、后台统计。
- 常见错误：无条件查询全表并在内存中过滤。
- 学习建议：查看执行计划，给高频过滤字段建立索引。
- 安全提示：所有查询参数化，禁止拼接 SQL。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_20_bililearn_local_startup.md｜启动 AI 中台前要确认什么

## K017 异步并发
- 能力维度：coding_implementation
- 能力单元：编码实现
- 知识点：异步函数应避免阻塞调用，独立 I/O 可并发执行并正确处理取消。
- 适用场景：多路检索、聚合接口、模型调用。
- 常见错误：在 async 路径调用阻塞式网络或文件操作。
- 学习建议：区分 CPU、同步 I/O 和异步 I/O，按类型选择方案。
- 安全提示：并发数量受控，避免压垮外部服务。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_27_detailed_design.md｜详细设计

## K018 文件与资源交付
- 能力维度：coding_implementation
- 能力单元：编码实现
- 知识点：生成资源应有稳定标识、格式、下载权限和失败状态。
- 适用场景：讲义、练习、导图和代码示例生成。
- 常见错误：只返回临时路径或生成成功但文件不可下载。
- 学习建议：保存元数据并通过后端接口生成下载地址。
- 安全提示：下载前校验用户归属和文件类型。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_17_labs_projects_and_tools.md｜典型工具与资料

## K019 版本与迁移
- 能力维度：coding_implementation
- 能力单元：编码实现
- 知识点：数据库结构变化通过可回滚迁移管理，代码和迁移一起评审。
- 适用场景：新增反馈记录、字段升级、团队协作。
- 常见错误：直接手改共享数据库，无法复现环境。
- 学习建议：每次变更包含 revision、升级和降级逻辑。
- 安全提示：生产迁移前备份并在隔离环境演练。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_20_bililearn_local_startup.md｜联调时推荐的检查顺序

## K020 可维护实现
- 能力维度：coding_implementation
- 能力单元：编码实现
- 知识点：适应变化时优先通过配置、接口和模块边界降低修改范围。
- 适用场景：课程替换、岗位替换、模型替换。
- 常见错误：把岗位名称、能力代码散落在多个页面和服务中。
- 学习建议：集中定义领域常量并增加契约测试。
- 安全提示：变更默认值前评估旧数据兼容性。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_29_adaptive_maintenance.md｜适应性维护

## K021 测试目标
- 能力维度：software_testing
- 能力单元：测试设计
- 知识点：测试用于发现缺陷、验证需求和评估质量，不是证明绝对无错。
- 适用场景：单元测试、接口验收、比赛演示。
- 常见错误：只测试成功路径。
- 学习建议：同时覆盖正常、边界、异常和权限场景。
- 安全提示：测试数据使用脱敏样例。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_28_software_testing_goal.md｜软件测试目标

## K022 单元测试
- 能力维度：software_testing
- 能力单元：测试设计
- 知识点：单元测试隔离被测函数，验证输入、输出和副作用。
- 适用场景：规则计算、数据转换、仓储方法。
- 常见错误：测试依赖真实网络和真实密钥。
- 学习建议：用 fixture、mock 和内存数据库保持可重复。
- 安全提示：测试日志不得输出密钥。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_28_software_testing_goal.md｜软件测试目标

## K023 集成测试
- 能力维度：software_testing
- 能力单元：测试设计
- 知识点：集成测试验证模块之间的接口和数据契约。
- 适用场景：前后端联调、服务聚合、RAG 工具调用。
- 常见错误：每个模块单测通过但联调字段不一致。
- 学习建议：用真实 schema 样例覆盖请求和响应。
- 安全提示：外部服务使用沙箱或固定测试账号。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_18_assessment_and_outcomes.md｜实验评价关注点

## K024 边界值分析
- 能力维度：software_testing
- 能力单元：测试设计
- 知识点：围绕最小值、最大值、空值和临界转换点设计用例。
- 适用场景：评分、分页、长度限制、状态枚举。
- 常见错误：只测一个中间值。
- 学习建议：每个数值字段至少覆盖边界内、边界值和边界外。
- 安全提示：非法输入应返回明确 4xx，不执行副作用。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_15_chapter_map.md｜第7章 软件测试调试与维护

## K025 权限隔离测试
- 能力维度：software_testing
- 能力单元：测试设计
- 知识点：资源查询和修改必须验证当前用户对目标数据的归属。
- 适用场景：学生建议、测评历史、个人报告。
- 常见错误：只按 record_id 查询，忽略 user_id。
- 学习建议：为跨用户读取、修改和删除分别写 404 或 403 用例。
- 安全提示：对外统一隐藏其他用户记录是否存在。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_18_assessment_and_outcomes.md｜能力与毕业要求关联

## K026 回归测试
- 能力维度：software_testing
- 能力单元：测试执行
- 知识点：修改共享契约后必须重新运行受影响模块的既有测试。
- 适用场景：新增接口、数据库迁移、模型替换。
- 常见错误：只运行新增测试。
- 学习建议：建立窄回归集合，再按风险扩大范围。
- 安全提示：失败时保留日志和复现输入，删除敏感字段。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_23_bililearn_troubleshooting.md｜AI 服务可用但页面还是报错怎么办

## K027 测试证据
- 能力维度：software_testing
- 能力单元：验收交付
- 知识点：测试结果应记录命令、通过数量、环境和剩余风险。
- 适用场景：比赛材料、PR、版本验收。
- 常见错误：只写“已测试”，没有可复核证据。
- 学习建议：保留终端输出和关键接口响应样例。
- 安全提示：截图前遮蔽本机路径、令牌和个人数据。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_18_assessment_and_outcomes.md｜课程产出导向

## K028 缺陷复盘
- 能力维度：software_testing
- 能力单元：缺陷分析
- 知识点：缺陷记录应包含现象、原因、影响、修复和防回归用例。
- 适用场景：测试失败、线上问题、答辩复盘。
- 常见错误：只修现象，不分析根因。
- 学习建议：按输入、状态、依赖和边界分类定位根因。
- 安全提示：复现样例去除真实账号和数据。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_28_software_testing_goal.md｜软件测试目标

## K029 验收标准
- 能力维度：software_testing
- 能力单元：验收交付
- 知识点：验收标准必须可观察、可测量并对应用户目标。
- 适用场景：比赛主链路、页面验收、接口交付。
- 常见错误：使用“体验良好”等不可验证表述。
- 学习建议：把每个目标转成 Given-When-Then 场景。
- 安全提示：涉及模型输出时同时验证来源和安全提示。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_18_assessment_and_outcomes.md｜实验评价关注点

## K030 测评反馈闭环
- 能力维度：software_testing
- 能力单元：评估反馈
- 知识点：测评结果应驱动薄弱点、学习任务和再次测评。
- 适用场景：岗位能力诊断、前后测报告。
- 常见错误：测评与学习路径互相独立。
- 学习建议：保存测评记录并在报告中展示变化依据。
- 安全提示：没有第二次测评时不要宣称提升。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_18_assessment_and_outcomes.md｜可用于系统的场景

## K031 任务拆解
- 能力维度：project_collaboration
- 能力单元：项目协作
- 知识点：把目标拆成负责人明确、可验收、有依赖关系的任务。
- 适用场景：四人比赛分工、迭代开发。
- 常见错误：任务名称太大，无法判断完成状态。
- 学习建议：每个任务写输入、输出、负责人和验收条件。
- 安全提示：避免在任务中暴露个人隐私。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_16_teaching_method.md｜常见课堂结构

## K032 分支协作
- 能力维度：project_collaboration
- 能力单元：项目协作
- 知识点：成员在独立功能分支开发，通过 PR 评审后合并主分支。
- 适用场景：多人并行开发、比赛版本管理。
- 常见错误：多人直接修改 main 或共享同一文件。
- 学习建议：按页面域和服务边界划分文件所有权。
- 安全提示：禁止提交 .env、令牌和运行日志。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_19_bililearn_project_overview.md｜项目包含哪些端

## K033 接口协作
- 能力维度：project_collaboration
- 能力单元：项目协作
- 知识点：接口字段由后端统一定义，前端按契约并行实现。
- 适用场景：三前端一后端联调。
- 常见错误：不同页面为同一概念定义不同字段名。
- 学习建议：接口文档先行，改字段必须同步通知和测试。
- 安全提示：错误消息不包含内部服务地址。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_22_bililearn_admin_and_rag.md｜知识库如何被加载

## K034 版本交付
- 能力维度：project_collaboration
- 能力单元：项目协作
- 知识点：提交信息应说明行为变化，PR 应附验证方法和剩余风险。
- 适用场景：代码评审、比赛封版。
- 常见错误：一个提交混入无关格式化和临时文件。
- 学习建议：保持提交小而完整，合并前同步 main。
- 安全提示：审查 diff 中是否含敏感内容。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_24_bililearn_usage_index.md｜这组文档的用途

## K035 角色边界
- 能力维度：project_collaboration
- 能力单元：项目协作
- 知识点：产品、前端、后端、测试和材料负责人应有清晰责任边界。
- 适用场景：团队排期、冲突处理、答辩准备。
- 常见错误：所有人都负责，实际无人验收。
- 学习建议：为每项交付指定一个最终负责人。
- 安全提示：对外发布前由负责人确认数据和截图脱敏。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_14_teaching_schedule.md｜典型教学组织方式

## K036 进度风险
- 能力维度：project_collaboration
- 能力单元：项目管理
- 知识点：识别关键路径、外部依赖和不可逆风险，提前设置替代方案。
- 适用场景：临时隧道、模型服务、比赛现场演示。
- 常见错误：把外部服务可用性当作确定条件。
- 学习建议：为每条演示链路准备本地降级和重试说明。
- 安全提示：降级模式不得伪造真实测评结果。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_20_bililearn_local_startup.md｜联调时推荐的检查顺序

## K037 交付文档
- 能力维度：project_collaboration
- 能力单元：项目交付
- 知识点：交付文档应覆盖架构、启动、接口、测试、来源和已知限制。
- 适用场景：比赛材料、团队交接、现场复现。
- 常见错误：文档与当前代码和分支不一致。
- 学习建议：每次功能提交同步更新对应文档。
- 安全提示：文档中的地址和样例不得带真实密钥。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_24_bililearn_usage_index.md｜文档清单

## K038 变更评审
- 能力维度：project_collaboration
- 能力单元：项目管理
- 知识点：变更评审要判断影响范围、兼容性、测试和回滚方案。
- 适用场景：公共接口、数据库迁移、工作流调整。
- 常见错误：只看新增代码，不看消费者。
- 学习建议：列出受影响页面、接口、数据和演示步骤。
- 安全提示：高风险变更先在隔离环境验证。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_29_adaptive_maintenance.md｜适应性维护

## K039 复盘会议
- 能力维度：project_collaboration
- 能力单元：项目协作
- 知识点：复盘聚焦事实、影响和可执行改进，不把问题归因于个人。
- 适用场景：联调失败、答辩演练、版本迭代。
- 常见错误：只记录结论，不记录行动负责人和截止时间。
- 学习建议：用“做得好、遇到的问题、下一步实验”组织复盘。
- 安全提示：试用反馈脱敏后再进入公开材料。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_18_assessment_and_outcomes.md｜课程产出导向

## K040 反馈闭环
- 能力维度：project_collaboration
- 能力单元：项目交付
- 知识点：用户反馈应记录任务、优点、问题、改进建议和用户身份说明。
- 适用场景：真实试用、比赛申报、产品迭代。
- 常见错误：用团队自评冒充真实用户反馈。
- 学习建议：保存原始反馈、时间和脱敏后的摘要。
- 安全提示：未经授权不公开姓名、账号或联系方式。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_18_assessment_and_outcomes.md｜可用于系统的场景

## K041 岗位能力映射
- 能力维度：requirement_analysis
- 能力单元：岗位分析
- 知识点：岗位任务应映射到可观察的能力维度和学习活动。
- 适用场景：岗位画像、学习路径、能力报告。
- 常见错误：岗位名称与测评指标没有关系。
- 学习建议：为每项任务标注能力代码和证据来源。
- 安全提示：画像结论标记数据来源和置信度。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_13_course_profile.md｜教学目标

## K042 学习目标分层
- 能力维度：requirement_analysis
- 能力单元：学习目标
- 知识点：学习目标应从理解、应用、分析到综合逐步提升。
- 适用场景：岗位实训计划、练习难度安排。
- 常见错误：目标只有“掌握”“熟悉”等不可测动词。
- 学习建议：使用解释、设计、实现、测试等可观察动词。
- 安全提示：不要依据单次回答给出过度确定的能力结论。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_13_course_profile.md｜教学目标

## K043 项目案例学习
- 能力维度：requirement_analysis
- 能力单元：场景理解
- 知识点：真实案例把抽象概念连接到业务目标、角色和约束。
- 适用场景：项目制教学、岗位任务训练。
- 常见错误：案例只讲技术，不说明业务价值。
- 学习建议：先描述场景，再要求学生产出设计或测试证据。
- 安全提示：案例数据使用虚构或脱敏数据。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_05.md｜企业实用报告案例

## K044 课程章节导航
- 能力维度：requirement_analysis
- 能力单元：学习规划
- 知识点：章节地图帮助学生理解先修关系、当前主题和后续能力。
- 适用场景：课程学习、资源推荐、路径生成。
- 常见错误：推荐内容与当前章节脱节。
- 学习建议：每次推荐说明前置知识和下一章节。
- 安全提示：未命中章节时提示人工确认，不猜测教材页码。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_15_chapter_map.md｜章节知识图谱

## K045 实验任务设计
- 能力维度：coding_implementation
- 能力单元：实践教学
- 知识点：实验应有目标、输入、步骤、产出和评价标准。
- 适用场景：编码练习、系统设计实验、测试实验。
- 常见错误：只有环境安装，没有可检查产出。
- 学习建议：每个实验至少要求一个可运行或可审查成果。
- 安全提示：实验在本地或测试环境运行。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_17_labs_projects_and_tools.md｜实验与课设方向

## K046 工具选择
- 能力维度：system_design
- 能力单元：工程实践
- 知识点：工具选择应匹配任务、团队能力、维护成本和许可证。
- 适用场景：数据库、消息队列、向量检索、CI。
- 常见错误：为了追新技术引入不必要依赖。
- 学习建议：记录选择理由、替代方案和退出成本。
- 安全提示：新增依赖进行许可证和漏洞检查。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_17_labs_projects_and_tools.md｜典型工具与资料

## K047 课程资料检索
- 能力维度：system_design
- 能力单元：RAG 检索
- 知识点：课程资料应按章节、标题、来源路径切片并保留元数据。
- 适用场景：AI 导师问答、引用展示、知识库维护。
- 常见错误：切片没有来源，命中后无法解释依据。
- 学习建议：每个 chunk 保存 source_name、source_path 和标题。
- 安全提示：检索不到时明确返回无来源状态。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_22_bililearn_admin_and_rag.md｜知识库如何被加载

## K048 RAG 入库质量
- 能力维度：system_design
- 能力单元：RAG 检索
- 知识点：入库文档需结构清晰、主题集中、来源真实并避免重复噪声。
- 适用场景：课程知识库建设、星辰知识库上传。
- 常见错误：把启动日志、临时输出和未审查文本一起上传。
- 学习建议：入库前执行字段、来源和重复条目检查。
- 安全提示：不得上传密钥、个人数据和未授权资料。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_22_bililearn_admin_and_rag.md｜入库资料应该怎么写更适合 AI 导师

## K049 RAG 未命中处理
- 能力维度：system_design
- 能力单元：RAG 检索
- 知识点：没有足够上下文时应降低确定性、说明限制并请求补充信息。
- 适用场景：专业问答、陌生标准、具体页码查询。
- 常见错误：用模型记忆补齐不存在的来源。
- 学习建议：将“暂无可核验来源”作为明确输出状态。
- 安全提示：高风险问题转人工或要求提供原始资料。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_23_bililearn_troubleshooting.md｜AI 导师回答项目问题时的优先策略

## K050 知识库维护
- 能力维度：project_collaboration
- 能力单元：知识运营
- 知识点：知识库更新要有版本、来源、审核状态和失效策略。
- 适用场景：课程替换、岗位迁移、比赛材料封版。
- 常见错误：更新内容后没有重新入库或通知消费者。
- 学习建议：维护知识目录和变更记录，定期清理过期条目。
- 安全提示：发布前检查许可证、个人数据和来源可追溯性。
- 来源：a3-ai-python/knowledge_base/software_engineering_4th/section_22_bililearn_admin_and_rag.md｜如何触发知识入库
