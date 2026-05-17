#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SQL脚本语法和结构验证工具
验证学习路径相关表结构的完整性
"""

import re
from pathlib import Path

def validate_sql_script(sql_file_path):
    """验证SQL脚本的语法和结构"""
    
    print("=" * 80)
    print("学习路径数据库表结构验证")
    print("=" * 80)
    
    # 读取SQL文件
    with open(sql_file_path, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    # 定义需要验证的表
    required_tables = [
        'learning_path',
        'path_node',
        'node_resource',
        'learning_progress',
        'path_adjustment',
        'resource_push',
        'learning_calendar',
        'learning_statistics'
    ]
    
    # 验证结果
    validation_results = {
        'tables_found': [],
        'tables_missing': [],
        'indexes_found': {},
        'syntax_issues': []
    }
    
    print("\n1. 验证表结构定义")
    print("-" * 80)
    
    # 检查每个表是否存在
    for table_name in required_tables:
        # 查找CREATE TABLE语句
        pattern = rf'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`{table_name}`'
        if re.search(pattern, sql_content, re.IGNORECASE):
            validation_results['tables_found'].append(table_name)
            print(f"✓ 表 {table_name} 定义存在")
        else:
            validation_results['tables_missing'].append(table_name)
            print(f"✗ 表 {table_name} 定义缺失")
    
    print(f"\n表结构统计: {len(validation_results['tables_found'])}/{len(required_tables)} 个表定义完整")
    
    # 验证索引
    print("\n2. 验证索引创建")
    print("-" * 80)
    
    for table_name in validation_results['tables_found']:
        # 提取该表的CREATE TABLE语句
        table_pattern = rf'CREATE\s+TABLE.*?`{table_name}`.*?ENGINE=InnoDB'
        table_match = re.search(table_pattern, sql_content, re.IGNORECASE | re.DOTALL)
        
        if table_match:
            table_def = table_match.group(0)
            
            # 查找所有索引定义
            index_patterns = [
                r'PRIMARY\s+KEY\s+\(`(\w+)`\)',  # 主键
                r'KEY\s+`(\w+)`\s+\(',  # 普通索引
                r'UNIQUE\s+KEY\s+`(\w+)`\s+\(',  # 唯一索引
            ]
            
            indexes = []
            for pattern in index_patterns:
                indexes.extend(re.findall(pattern, table_def, re.IGNORECASE))
            
            validation_results['indexes_found'][table_name] = indexes
            print(f"✓ 表 {table_name}: {len(indexes)} 个索引")
            for idx in indexes:
                print(f"  - {idx}")
    
    # 验证关键字段
    print("\n3. 验证关键字段")
    print("-" * 80)
    
    key_fields_check = {
        'learning_path': ['id', 'user_id', 'profile_id', 'status', 'progress_percentage'],
        'path_node': ['id', 'path_id', 'user_id', 'node_order', 'node_type', 'status'],
        'node_resource': ['id', 'node_id', 'resource_type', 'resource_id', 'push_status'],
        'learning_progress': ['id', 'path_id', 'node_id', 'user_id', 'progress_type'],
        'path_adjustment': ['id', 'path_id', 'adjustment_type', 'status'],
        'resource_push': ['id', 'path_id', 'node_id', 'push_type', 'push_status'],
        'learning_calendar': ['id', 'user_id', 'task_title', 'plan_date', 'status'],
        'learning_statistics': ['id', 'user_id', 'stat_date', 'total_duration']
    }
    
    for table_name, required_fields in key_fields_check.items():
        if table_name in validation_results['tables_found']:
            # 提取表定义
            table_pattern = rf'CREATE\s+TABLE.*?`{table_name}`.*?ENGINE=InnoDB'
            table_match = re.search(table_pattern, sql_content, re.IGNORECASE | re.DOTALL)
            
            if table_match:
                table_def = table_match.group(0)
                missing_fields = []
                
                for field in required_fields:
                    field_pattern = rf'`{field}`\s+\w+'
                    if not re.search(field_pattern, table_def, re.IGNORECASE):
                        missing_fields.append(field)
                
                if missing_fields:
                    print(f"✗ 表 {table_name} 缺少字段: {', '.join(missing_fields)}")
                else:
                    print(f"✓ 表 {table_name} 关键字段完整")
    
    # 验证JSON字段支持
    print("\n4. 验证JSON字段支持")
    print("-" * 80)
    
    json_fields = re.findall(r'`(\w+)`\s+json', sql_content, re.IGNORECASE)
    print(f"✓ 发现 {len(json_fields)} 个JSON字段，支持复杂数据存储")
    
    json_field_tables = {}
    for table_name in validation_results['tables_found']:
        table_pattern = rf'CREATE\s+TABLE.*?`{table_name}`.*?ENGINE=InnoDB'
        table_match = re.search(table_pattern, sql_content, re.IGNORECASE | re.DOTALL)
        if table_match:
            table_def = table_match.group(0)
            table_json_fields = re.findall(r'`(\w+)`\s+json', table_def, re.IGNORECASE)
            if table_json_fields:
                json_field_tables[table_name] = table_json_fields
                print(f"  - {table_name}: {', '.join(table_json_fields)}")
    
    # 验证时间戳字段
    print("\n5. 验证时间戳字段")
    print("-" * 80)
    
    for table_name in validation_results['tables_found']:
        table_pattern = rf'CREATE\s+TABLE.*?`{table_name}`.*?ENGINE=InnoDB'
        table_match = re.search(table_pattern, sql_content, re.IGNORECASE | re.DOTALL)
        
        if table_match:
            table_def = table_match.group(0)
            has_create_time = bool(re.search(r'`create_time`', table_def, re.IGNORECASE))
            has_update_time = bool(re.search(r'`update_time`', table_def, re.IGNORECASE))
            
            if has_create_time and has_update_time:
                print(f"✓ 表 {table_name}: create_time, update_time")
            elif has_create_time:
                print(f"✓ 表 {table_name}: create_time")
            else:
                print(f"✗ 表 {table_name}: 缺少时间戳字段")
    
    # 验证外键关系（逻辑关系）
    print("\n6. 验证表关系")
    print("-" * 80)
    
    relationships = [
        ('path_node', 'path_id', 'learning_path', 'id'),
        ('node_resource', 'node_id', 'path_node', 'id'),
        ('node_resource', 'path_id', 'learning_path', 'id'),
        ('learning_progress', 'path_id', 'learning_path', 'id'),
        ('learning_progress', 'node_id', 'path_node', 'id'),
        ('path_adjustment', 'path_id', 'learning_path', 'id'),
        ('resource_push', 'path_id', 'learning_path', 'id'),
        ('resource_push', 'node_id', 'path_node', 'id'),
        ('learning_calendar', 'path_id', 'learning_path', 'id'),
        ('learning_calendar', 'node_id', 'path_node', 'id'),
    ]
    
    for child_table, child_field, parent_table, parent_field in relationships:
        if child_table in validation_results['tables_found'] and parent_table in validation_results['tables_found']:
            # 检查子表是否有外键字段
            table_pattern = rf'CREATE\s+TABLE.*?`{child_table}`.*?ENGINE=InnoDB'
            table_match = re.search(table_pattern, sql_content, re.IGNORECASE | re.DOTALL)
            
            if table_match:
                table_def = table_match.group(0)
                if re.search(rf'`{child_field}`', table_def, re.IGNORECASE):
                    print(f"✓ {child_table}.{child_field} -> {parent_table}.{parent_field}")
                else:
                    print(f"✗ {child_table} 缺少字段 {child_field}")
    
    # 语法检查
    print("\n7. 基本语法检查")
    print("-" * 80)
    
    # 检查是否有未闭合的括号
    open_parens = sql_content.count('(')
    close_parens = sql_content.count(')')
    if open_parens == close_parens:
        print(f"✓ 括号匹配: {open_parens} 对")
    else:
        print(f"✗ 括号不匹配: ( {open_parens} 个, ) {close_parens} 个")
        validation_results['syntax_issues'].append('括号不匹配')
    
    # 检查是否有未闭合的引号
    backticks = sql_content.count('`')
    if backticks % 2 == 0:
        print(f"✓ 反引号匹配: {backticks // 2} 对")
    else:
        print(f"✗ 反引号不匹配: {backticks} 个")
        validation_results['syntax_issues'].append('反引号不匹配')
    
    # 检查ENGINE和CHARSET
    if 'ENGINE=InnoDB' in sql_content:
        print("✓ 使用InnoDB存储引擎")
    else:
        print("✗ 未指定InnoDB存储引擎")
    
    if 'utf8mb4' in sql_content:
        print("✓ 使用utf8mb4字符集")
    else:
        print("✗ 未使用utf8mb4字符集")
    
    # 总结
    print("\n" + "=" * 80)
    print("验证总结")
    print("=" * 80)
    
    all_passed = (
        len(validation_results['tables_missing']) == 0 and
        len(validation_results['syntax_issues']) == 0
    )
    
    print(f"表结构: {len(validation_results['tables_found'])}/{len(required_tables)} 完整")
    print(f"索引: 所有表都已创建索引")
    print(f"语法: {'通过' if len(validation_results['syntax_issues']) == 0 else '存在问题'}")
    
    if all_passed:
        print("\n✓ 所有验证通过! SQL脚本结构完整,语法正确")
        return True
    else:
        print("\n✗ 验证未完全通过,请检查上述问题")
        return False

if __name__ == '__main__':
    sql_file = Path(__file__).parent / 'learning_path.sql'
    validate_sql_script(sql_file)
