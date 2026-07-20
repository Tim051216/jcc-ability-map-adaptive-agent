import asyncio
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import delete  # noqa: E402

from app.db.models.evaluation_test import EvaluationQuestion as EvaluationQuestionModel  # noqa: E402
from app.db.session import async_session_factory, ensure_sqlite_schema  # noqa: E402
from app.schemas.evaluation import EvaluationQuestion  # noqa: E402
from app.services.evaluation_service import EvaluationService  # noqa: E402


TEST_ID = 401
GENERATION_PROMPT = "manual_seed:software_engineering:scenario_questions:v1"


def q(
    question_id: str,
    point: str,
    prompt: str,
    options: list[str],
    correct: str,
    explanation: str,
    difficulty: str = "advanced",
) -> EvaluationQuestion:
    return EvaluationQuestion(
        question_id=question_id,
        question_type="single_choice",
        prompt=prompt,
        options=options,
        correct_answer=correct,
        explanation=explanation,
        knowledge_point=point,
        difficulty=difficulty,
        source="ai",
    )


QUESTIONS = [
    q(
        "seed-q01",
        "数据结构：栈与队列",
        "使用数组实现栈时，`top` 表示栈顶下标，容量为 `capacity`。执行 `push(x)` 前最应该先判断哪一项？",
        ["A. `top == capacity - 1`", "B. `top == -1`", "C. `x == null`", "D. 数组是否已经升序"],
        "A",
        "数组栈容量固定，入栈前必须判断栈满，否则 `top + 1` 后写入数组会越界。",
    ),
    q(
        "seed-q02",
        "数据结构：栈与队列",
        "表达式括号匹配算法通常使用哪种数据结构保存尚未匹配的左括号？",
        ["A. 栈", "B. 队列", "C. 堆", "D. 邻接表"],
        "A",
        "括号匹配遵循后出现的左括号先匹配右括号，符合栈的 LIFO 特性。",
    ),
    q(
        "seed-q03",
        "数据结构：栈与队列",
        "打印任务按提交先后顺序依次处理，最适合使用哪种结构？",
        ["A. 队列", "B. 栈", "C. 二叉搜索树", "D. 哈希集合"],
        "A",
        "按提交顺序先到先服务是 FIFO 语义，队列正是这种访问规则。",
    ),
    q(
        "seed-q04",
        "数据结构：栈与队列",
        "循环队列长度为 `n`，通常牺牲一个存储单元区分队空和队满。队满条件常写成哪一项？",
        ["A. `(rear + 1) % n == front`", "B. `rear == front`", "C. `front == -1`", "D. `rear < front`"],
        "A",
        "循环队列保留一个空位时，尾指针再前进一步就追上头指针，表示队列已满。",
    ),
    q(
        "seed-q05",
        "数据结构：栈与队列",
        "用两个栈实现队列时，删除队头元素通常怎么做？",
        ["A. 输出栈为空时，把输入栈元素逐个弹出压入输出栈，再从输出栈弹出", "B. 直接删除输入栈栈底", "C. 随机弹出任意一个栈元素", "D. 每次都把两个栈清空"],
        "A",
        "输入栈到输出栈的倒序转移能把最早入队元素放到输出栈栈顶，从而实现 FIFO。",
    ),
    q(
        "seed-q06",
        "Java 基础语法",
        "下面 Java 代码执行后输出什么？`int[] a = {1, 2, 3}; System.out.println(a[1]);`",
        ["A. 1", "B. 2", "C. 3", "D. 编译错误"],
        "B",
        "Java 数组下标从 0 开始，`a[1]` 访问第二个元素，值为 2。",
    ),
    q(
        "seed-q07",
        "Java 基础语法",
        "在 Java 中，`String s = \"abc\"; s.toUpperCase(); System.out.println(s);` 输出什么？",
        ["A. abc", "B. ABC", "C. null", "D. 编译错误"],
        "A",
        "String 是不可变对象，`toUpperCase()` 返回新字符串，不会修改原变量 `s`。",
    ),
    q(
        "seed-q08",
        "Java 基础语法",
        "下面哪种集合最适合按照 key 快速查找 value？",
        ["A. HashMap", "B. ArrayList", "C. LinkedList", "D. Stack"],
        "A",
        "HashMap 基于哈希映射，适合按键进行平均 O(1) 的查找、插入和删除。",
    ),
    q(
        "seed-q09",
        "Java 基础语法",
        "Java 中 `finally` 代码块的主要特点是什么？",
        ["A. 通常无论是否发生异常都会执行", "B. 只能写在 `if` 后面", "C. 一定先于 `try` 执行", "D. 只能返回布尔值"],
        "A",
        "`finally` 常用于释放资源，正常执行或捕获异常后通常都会运行。",
    ),
    q(
        "seed-q10",
        "Java 基础语法",
        "接口 `List` 变量可以引用 `ArrayList` 对象，这体现了面向对象的哪种特性？",
        ["A. 多态", "B. 封装破坏", "C. 死锁", "D. SQL 注入"],
        "A",
        "父类型或接口引用指向具体实现类对象，是 Java 多态使用中的常见形式。",
    ),
    q(
        "seed-q11",
        "算法复杂度分析",
        "对长度为 n 的无序数组做线性查找，最坏情况下时间复杂度是多少？",
        ["A. O(1)", "B. O(log n)", "C. O(n)", "D. O(n^2)"],
        "C",
        "最坏情况下目标元素不存在或在最后一个位置，需要检查 n 个元素。",
    ),
    q(
        "seed-q12",
        "算法复杂度分析",
        "二分查找要求数组满足什么前提？",
        ["A. 有序", "B. 元素全为正数", "C. 长度必须是偶数", "D. 不能包含重复元素"],
        "A",
        "二分查找依赖有序性，每次根据中间值排除一半搜索空间。",
    ),
    q(
        "seed-q13",
        "算法复杂度分析",
        "双重循环 `for i in 0..n-1`、`for j in 0..n-1` 内部执行常数操作，时间复杂度通常是多少？",
        ["A. O(n)", "B. O(n^2)", "C. O(log n)", "D. O(1)"],
        "B",
        "外层 n 次、内层 n 次，总执行次数约为 n*n，因此是 O(n^2)。",
    ),
    q(
        "seed-q14",
        "算法复杂度分析",
        "快速排序平均时间复杂度通常是多少？",
        ["A. O(n log n)", "B. O(n)", "C. O(log n)", "D. O(n^3)"],
        "A",
        "快速排序平均情况下每层划分总工作量 O(n)，递归深度约 O(log n)。",
    ),
    q(
        "seed-q15",
        "算法复杂度分析",
        "如果算法只使用固定数量的整型变量，不随输入规模 n 增长，额外空间复杂度是多少？",
        ["A. O(1)", "B. O(n)", "C. O(n log n)", "D. O(n^2)"],
        "A",
        "额外空间不随输入规模变化，属于常数空间复杂度。",
    ),
    q(
        "seed-q16",
        "数据库索引与约束",
        "给用户表 `email` 字段建立唯一索引，主要目的是什么？",
        ["A. 保证邮箱不重复并提升按邮箱查询效率", "B. 自动加密邮箱", "C. 删除空邮箱", "D. 让所有查询都不访问磁盘"],
        "A",
        "唯一索引兼具唯一性约束和检索加速作用，但不会自动加密或清洗数据。",
    ),
    q(
        "seed-q17",
        "数据库索引与约束",
        "SQL 中 `WHERE user_id = ? AND status = ?` 高频查询，较合适的优化方式是什么？",
        ["A. 建立 `(user_id, status)` 联合索引", "B. 删除主键", "C. 把字段名改短", "D. 每次查询前清空表"],
        "A",
        "联合索引可以匹配高频组合过滤条件，减少扫描范围并提升查询效率。",
    ),
    q(
        "seed-q18",
        "数据库索引与约束",
        "事务的 ACID 中，Isolation 指的是什么？",
        ["A. 隔离性", "B. 原子性", "C. 持久性", "D. 一致性"],
        "A",
        "Isolation 是隔离性，强调并发事务之间的相互影响需要被控制。",
    ),
    q(
        "seed-q19",
        "数据库索引与约束",
        "外键约束主要用于保证什么？",
        ["A. 表之间引用关系的完整性", "B. 查询结果自动排序", "C. 字符串自动压缩", "D. SQL 自动补全"],
        "A",
        "外键用于维护子表字段与父表主键或唯一键之间的引用一致性。",
    ),
    q(
        "seed-q20",
        "数据库索引与约束",
        "在 B+ 树索引中，范围查询效率较高的一个重要原因是什么？",
        ["A. 叶子节点通常按 key 有序并通过链表连接", "B. 所有数据都存储在根节点", "C. 每次查询都全表扫描", "D. 索引会自动执行程序代码"],
        "A",
        "B+ 树叶子节点有序且相连，定位起点后可顺序扫描范围内的 key。",
    ),
    q(
        "seed-q21",
        "操作系统进程线程",
        "进程和线程的关系，哪项描述更准确？",
        ["A. 进程是资源分配的基本单位，线程是 CPU 调度的基本单位", "B. 线程拥有完全独立地址空间", "C. 一个进程只能有一个线程", "D. 线程之间不能共享进程资源"],
        "A",
        "进程通常拥有资源和地址空间，线程运行在进程内部并作为调度执行单位。",
    ),
    q(
        "seed-q22",
        "操作系统进程线程",
        "多个线程同时修改同一个计数器，最可能出现什么问题？",
        ["A. 竞态条件", "B. 编译器丢失", "C. DNS 解析失败", "D. 数据库表自动删除"],
        "A",
        "共享变量并发读写如果缺少同步，就可能因执行顺序不确定产生竞态条件。",
    ),
    q(
        "seed-q23",
        "操作系统进程线程",
        "互斥锁主要用于解决什么问题？",
        ["A. 保护临界区，避免多个线程同时访问共享资源", "B. 提高显示器刷新率", "C. 压缩磁盘文件", "D. 自动生成进程号"],
        "A",
        "互斥锁保证同一时刻只有一个线程进入临界区，从而保护共享数据一致性。",
    ),
    q(
        "seed-q24",
        "操作系统进程线程",
        "死锁产生的必要条件之一是什么？",
        ["A. 循环等待", "B. 所有线程都只读数据", "C. CPU 空闲", "D. 没有任何共享资源"],
        "A",
        "死锁的必要条件包括互斥、占有并等待、不可剥夺和循环等待。",
    ),
    q(
        "seed-q25",
        "操作系统进程线程",
        "进程上下文切换通常需要保存和恢复哪些信息？",
        ["A. 程序计数器、寄存器、栈指针等运行现场", "B. 显示器亮度", "C. 源代码注释", "D. 鼠标位置"],
        "A",
        "上下文切换要保存当前执行现场并恢复下一个任务现场，才能让进程之后继续执行。",
    ),
]


async def main() -> None:
    await ensure_sqlite_schema()
    async with async_session_factory() as session:
        await session.execute(
            delete(EvaluationQuestionModel).where(
                EvaluationQuestionModel.test_id == TEST_ID,
                EvaluationQuestionModel.knowledge_point.like("%?%"),
            )
        )
        await session.commit()

    service = EvaluationService()
    await service._save_question_pool_entries(
        test_id=TEST_ID,
        questions=QUESTIONS,
        generation_prompt=GENERATION_PROMPT,
        delete_generation_prompt=GENERATION_PROMPT,
    )
    print(f"seeded {len(QUESTIONS)} questions for test_id={TEST_ID}")


if __name__ == "__main__":
    asyncio.run(main())
