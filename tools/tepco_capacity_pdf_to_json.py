#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tools/tepco_capacity_pdf_to_json.py

東電の送電線空容量PDF（akiyouryou_kikan.pdf）から送電線データを抽出し、
powerLineCapacity.json を生成する。

入力: data/power/tepco/akiyouryou_kikan.pdf
出力: data/power/powerLineCapacity.json

使用ライブラリ: camelot-py (pip install "camelot-py[base]")
"""

import json
import os
import re
from pathlib import Path

try:
    import camelot
except ImportError:
    print("Error: camelot-py is not installed. Please run: pip install 'camelot-py[base]'")
    exit(1)


def clean_text(text):
    """テキストをクリーニング（改行・空白除去）"""
    if text is None:
        return ""
    return text.strip().replace("\n", "").replace("\r", "")





def parse_numeric_or_text(value):
    """
    数値または文字列（♯1のような例）をパースする。
    - 整数に変換できればint
    - 小数に変換できればfloat
    - それ以外は文字列のまま返す
    """
    cleaned = clean_text(value)
    if not cleaned or cleaned == "-" or cleaned == "":
        return None
    
    # カンマを除去
    cleaned = cleaned.replace(",", "")
    
    # 整数変換を試みる
    try:
        return int(cleaned)
    except ValueError:
        pass
    
    # 小数変換を試みる
    try:
        return float(cleaned)
    except ValueError:
        pass
    
    # それ以外は文字列のまま返す
    return cleaned


def is_transmission_line_row(row):
    """
    送電線の行かどうかを判定する（正しい列構造）。
    col 0 = "基幹"（固定）
    col 1 = 電圧（例：275kV, 500kV）
    col 2 = 送電線No（整数）
    col 3 = 送電線名（例：君津線、新袖ヶ浦線）
    
    判定条件：
    - row[2]: 整数として解釈可能（送電線No）
    - row[3]: 「線」が含まれる（送電線名）
    - row[3]: 「変」が含まれない（変電所を除外）
    - len(row) >= 12
    """
    if len(row) < 12:
        return False
    
    no_str = clean_text(str(row[2]))
    line_name = clean_text(str(row[3]))
    
    # Noが空欄または整数でない場合はスキップ
    if not no_str or no_str == "":
        return False
    
    try:
        int(no_str)
    except ValueError:
        return False
    
    # 送電線名が空欄ならスキップ
    if not line_name or line_name == "":
        return False
    
    # 「線」が含まれていれば送電線
    if "線" in line_name:
        # 変電所名（「変」が含まれる）は除外
        if "変" in line_name:
            return False
        return True
    
    return False


def extract_transmission_lines(pdf_path):
    """
    PDFから送電線データを抽出し、辞書形式で返す。
    Camelot（flavor="stream" + bbox指定）で表領域を強制抽出。
    """
    result = {}
    
    print("[Camelot] テーブル抽出中（flavor='stream', bbox指定）...")
    
    # Camelotでテーブル抽出（bbox指定で表領域を強制抽出）
    # 東電PDF page 7-9 の表領域: 正確な座標
    tables = camelot.read_pdf(
        str(pdf_path),
        pages="7-9",
        flavor="stream",
        table_areas=["30,480,565,40"],
        strip_text=" \n"
    )
    
    print(f"[Camelot] 抽出テーブル数: {len(tables)}")
    
    for table_idx, table in enumerate(tables):
        print(f"[テーブル {table_idx + 1}/{len(tables)}] 処理中...")
        
        # DataFrameを取得
        df = table.df
        
        if df.empty:
            print(f"  スキップ: 空のテーブル")
            continue
        
        print(f"  DataFrame shape: {df.shape}")
        print(f"  先頭5行:")
        print(df.head(5))
        print()
        
        # 全行を処理（1行目をヘッダとみなさず、送電線行を直接判定）
        for row_idx in range(len(df)):
            row = [clean_text(str(cell)) for cell in df.iloc[row_idx]]
            
            # 送電線の行かどうかを判定
            if not is_transmission_line_row(row):
                continue
            
            # 列数が15未満ならスキップ（全項目揃わない）
            if len(row) < 15:
                print(f"  警告: 行 {row_idx} は列数不足（{len(row)}列）- スキップ")
                continue
            
            # データ抽出（正しい列インデックス）
            # col 0 = "基幹"（固定）
            # col 1 = 電圧（例：275kV, 500kV）
            # col 2 = 送電線No（整数）
            # col 3 = 送電線名（例：君津線、新袖ヶ浦線）
            # col 4 = （不明）
            # col 5 = 回線数
            # col 6 = 設備容量
            # col 7 = 運用容量
            # col 8 = 制約要因
            # col 9 = 空容量(当該)
            # col 10 = 空容量(上位)
            # col 11 = N-1可否
            # col 12 = N-1量
            # col 13 = 出力制御
            # col 14 = 出力制御設備
            no = clean_text(row[2])
            line_name = clean_text(row[3])
            # 電圧からkVを除去して数値化
            voltage_str = clean_text(row[1]).replace("kV", "").replace("ｋV", "")
            voltage_kv = parse_numeric_or_text(voltage_str)
            circuits = parse_numeric_or_text(row[5])
            equipment_capacity_mw = parse_numeric_or_text(row[6])
            operation_capacity_mw = parse_numeric_or_text(row[7])
            capacity_constraint = clean_text(row[8])
            available_local_mw = parse_numeric_or_text(row[9])
            available_upstream_mw = parse_numeric_or_text(row[10])
            n1_applicable = clean_text(row[11])
            n1_limit_mw = parse_numeric_or_text(row[12])
            normal_output_control = clean_text(row[13])
            normal_output_control_required = clean_text(row[14]) if len(row) > 14 else None
            
            # JSONエントリ作成
            entry = {
                "line_name": line_name,
                "voltage_kv": voltage_kv,
                "circuits": circuits,
                "equipment_capacity_mw": equipment_capacity_mw,
                "operation_capacity_mw": operation_capacity_mw,
                "capacity_constraint": capacity_constraint if capacity_constraint else None,
                "available_local_mw": available_local_mw,
                "available_upstream_mw": available_upstream_mw,
                "n1_applicable": n1_applicable if n1_applicable else None,
                "n1_limit_mw": n1_limit_mw,
                "normal_output_control": normal_output_control if normal_output_control else None,
                "normal_output_control_required": normal_output_control_required if normal_output_control_required else None
            }
            
            result[no] = entry
            print(f"    抽出: No.{no} - {line_name} ({voltage_kv}kV)")
    
    return result


def main():
    # パス設定
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    input_pdf = project_root / "data" / "power" / "tepco" / "akiyouryou_kikan.pdf"
    output_json = project_root / "data" / "power" / "powerLineCapacity.json"
    
    print("=" * 60)
    print("東電送電線空容量PDF → JSON変換スクリプト")
    print("=" * 60)
    print(f"入力PDF: {input_pdf}")
    print(f"出力JSON: {output_json}")
    print()
    
    # 入力ファイルの存在チェック
    if not input_pdf.exists():
        print(f"Error: 入力PDFが見つかりません: {input_pdf}")
        exit(1)
    
    # PDF解析
    print("[処理開始] PDFからテーブル抽出中...")
    transmission_lines = extract_transmission_lines(input_pdf)
    
    print()
    print(f"[完了] 送電線データ抽出件数: {len(transmission_lines)} 件")
    print()
    
    # 出力ディレクトリ作成
    output_json.parent.mkdir(parents=True, exist_ok=True)
    
    # JSON書き出し
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(transmission_lines, f, ensure_ascii=False, indent=2)
    
    print(f"[保存完了] {output_json}")
    print()
    print("サンプル（最初の3件）:")
    for i, (no, data) in enumerate(list(transmission_lines.items())[:3], start=1):
        print(f"  {i}. No.{no}: {data['line_name']} ({data['voltage_kv']}kV, {data['available_local_mw']}MW)")
    print()
    print("=" * 60)


if __name__ == "__main__":
    main()
