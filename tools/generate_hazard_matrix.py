#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_hazard_matrix.py

metadata_light.xml から hazardMatrix.json と hazardMatrix.js を自動生成する

使用方法:
    python generate_hazard_matrix.py [input_xml_path] [output_dir]

    input_xml_path: metadata_light.xml のパス（デフォルト: ./data/metadata_light.xml）
    output_dir: 出力先ディレクトリ（デフォルト: ./data）
"""

import xml.etree.ElementTree as ET
import json
import re
import sys
import os
from pathlib import Path

# XML名前空間定義
NAMESPACES = {
    'wmts': 'http://www.opengis.net/wmts/1.0',
    'ows': 'http://www.opengis.net/ows/1.1',
    'xlink': 'http://www.w3.org/1999/xlink'
}

# TileMatrixSet のズームレベル定義（GSI標準）
TILEMATRIX_ZOOM_MAP = {
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '8': 8, '9': 9, '10': 10, '11': 11, '12': 12, '13': 13, '14': 14,
    '15': 15, '16': 16, '17': 17, '18': 18, '19': 19, '20': 20
}


def extract_directory_from_template(template_url):
    """
    template URL からディレクトリ名を抽出
    例: https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png
    → 01_flood_l2_shinsuishin_data
    """
    match = re.search(r'/raster/([^/]+)/', template_url)
    if match:
        return match.group(1)
    return None


def detect_pref_or_data(directory_name):
    """
    ディレクトリ名から pref-or-data を判定
    *_data で終わる場合 → "pref-or-data"
    それ以外 → "data"
    """
    if directory_name and directory_name.endswith('_data'):
        return 'pref-or-data'
    return 'data'


def generate_id_from_directory(directory_name):
    """
    ディレクトリ名から id を生成
    例: 01_flood_l2_shinsuishin_data → flood_l2_shinsuishin
    """
    if not directory_name:
        return None
    
    # 先頭の数字とアンダースコアを削除
    id_name = re.sub(r'^\d+_', '', directory_name)
    
    # 末尾の _data を削除
    id_name = re.sub(r'_data$', '', id_name)
    
    return id_name


def get_zoom_range(layer_elem):
    """
    Layer要素から minzoom と maxzoom を取得
    TileMatrixSetLink → TileMatrixSet から判定
    """
    minzoom = 2  # デフォルト
    maxzoom = 17  # デフォルト
    
    # TileMatrixSetLink を探す
    tilematrix_links = layer_elem.findall('.//wmts:TileMatrixSetLink', NAMESPACES)
    
    if tilematrix_links:
        # 最初のリンクから TileMatrixSet を取得
        tilematrix_set = tilematrix_links[0].find('wmts:TileMatrixSet', NAMESPACES)
        
        if tilematrix_set is not None and tilematrix_set.text:
            # TileMatrixSet が "0-17" のような形式の場合
            match = re.match(r'(\d+)-(\d+)', tilematrix_set.text)
            if match:
                minzoom = int(match.group(1))
                maxzoom = int(match.group(2))
            else:
                # 単一の数値の場合（通常はこちら）
                # TileMatrixLimits を確認して範囲を取得
                limits = tilematrix_links[0].findall('.//wmts:TileMatrixLimits', NAMESPACES)
                if limits:
                    zoom_levels = []
                    for limit in limits:
                        tm = limit.find('wmts:TileMatrix', NAMESPACES)
                        if tm is not None and tm.text in TILEMATRIX_ZOOM_MAP:
                            zoom_levels.append(TILEMATRIX_ZOOM_MAP[tm.text])
                    
                    if zoom_levels:
                        minzoom = min(zoom_levels)
                        maxzoom = max(zoom_levels)
    
    return minzoom, maxzoom


def parse_metadata_xml(xml_path):
    """
    metadata_light.xml を解析して hazardMatrix データを生成
    """
    print(f"[INFO] XMLファイルを解析中: {xml_path}")
    
    tree = ET.parse(xml_path)
    root = tree.getroot()
    
    hazard_matrix = {}
    
    # Layer 要素を全て抽出
    layers = root.findall('.//wmts:Layer', NAMESPACES)
    
    print(f"[INFO] {len(layers)} 個のレイヤーを検出")
    
    for layer in layers:
        # タイトル（日本語）
        title_elem = layer.find('ows:Title', NAMESPACES)
        title = title_elem.text if title_elem is not None else "不明"
        
        # ID（ows:Identifier）
        id_elem = layer.find('ows:Identifier', NAMESPACES)
        layer_id = id_elem.text if id_elem is not None else None
        
        if not layer_id:
            print(f"[WARN] ID が見つからないレイヤーをスキップ: {title}")
            continue
        
        # ResourceURL の template
        resource_url_elem = layer.find('.//wmts:ResourceURL', NAMESPACES)
        if resource_url_elem is None:
            print(f"[WARN] ResourceURL が見つからないレイヤーをスキップ: {layer_id}")
            continue
        
        template = resource_url_elem.get('template', '')
        
        # {TileMatrix}/{TileCol}/{TileRow} を {z}/{x}/{y} に置換
        template = template.replace('{TileMatrix}', '{z}')
        template = template.replace('{TileCol}', '{x}')
        template = template.replace('{TileRow}', '{y}')
        
        # ディレクトリ名を抽出
        directory = extract_directory_from_template(template)
        
        if not directory:
            print(f"[WARN] ディレクトリ名を抽出できないレイヤーをスキップ: {layer_id}")
            continue
        
        # pref-or-data 判定
        pref_or_data = detect_pref_or_data(directory)
        
        # id 生成（ディレクトリ名ベース）
        generated_id = generate_id_from_directory(directory)
        
        if not generated_id:
            generated_id = layer_id
        
        # minzoom / maxzoom 取得
        minzoom, maxzoom = get_zoom_range(layer)
        
        # hazardMatrix に追加
        hazard_matrix[generated_id] = {
            'title': title,
            'id': generated_id,
            'directory': directory,
            'template': template,
            'prefOrData': pref_or_data,
            'minzoom': minzoom,
            'maxzoom': maxzoom
        }
        
        print(f"[INFO] 追加: {generated_id} - {title}")
    
    # MLIT 液状化 API を追加
    print("[INFO] MLIT液状化APIを追加")
    hazard_matrix['mlit_liquefaction'] = {
        'title': '液状化（MLIT全国）',
        'id': 'mlit_liquefaction',
        'directory': 'liquefaction',
        'template': 'https://disaportal.mlit.go.jp/raster/liquefaction/{z}/{x}/{y}.png',
        'prefOrData': 'data',
        'minzoom': 2,
        'maxzoom': 17
    }
    
    return hazard_matrix


def save_json(hazard_matrix, output_path):
    """
    hazardMatrix.json を保存
    """
    print(f"[INFO] JSON出力: {output_path}")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(hazard_matrix, f, ensure_ascii=False, indent=2)
    
    print(f"[SUCCESS] {output_path} を生成しました")


def save_js(hazard_matrix, output_path):
    """
    hazardMatrix.js を保存（ES6 export 形式）
    """
    print(f"[INFO] JS出力: {output_path}")
    
    lines = ['// Auto-generated from metadata_light.xml', '']
    lines.append('export const hazardMatrix = {')
    
    for idx, (key, value) in enumerate(hazard_matrix.items()):
        is_last = (idx == len(hazard_matrix) - 1)
        
        lines.append(f'  "{key}": {{')
        lines.append(f'    title: "{value["title"]}",')
        lines.append(f'    id: "{value["id"]}",')
        lines.append(f'    directory: "{value["directory"]}",')
        lines.append(f'    template: "{value["template"]}",')
        lines.append(f'    prefOrData: "{value["prefOrData"]}",')
        lines.append(f'    minzoom: {value["minzoom"]},')
        lines.append(f'    maxzoom: {value["maxzoom"]}')
        
        if is_last:
            lines.append('  }')
        else:
            lines.append('  },')
    
    lines.append('};')
    lines.append('')
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    
    print(f"[SUCCESS] {output_path} を生成しました")


def main():
    """
    メイン処理
    """
    # 引数解析
    if len(sys.argv) >= 2:
        input_xml = sys.argv[1]
    else:
        input_xml = './data/metadata_light.xml'
    
    if len(sys.argv) >= 3:
        output_dir = sys.argv[2]
    else:
        output_dir = './data'
    
    # パスを絶対パスに変換
    input_xml = os.path.abspath(input_xml)
    output_dir = os.path.abspath(output_dir)
    
    # 入力ファイルの存在確認
    if not os.path.exists(input_xml):
        print(f"[ERROR] 入力ファイルが見つかりません: {input_xml}")
        print(f"[INFO] 使用方法: python {sys.argv[0]} [input_xml_path] [output_dir]")
        sys.exit(1)
    
    # 出力ディレクトリの作成
    os.makedirs(output_dir, exist_ok=True)
    
    # XML解析
    try:
        hazard_matrix = parse_metadata_xml(input_xml)
    except Exception as e:
        print(f"[ERROR] XML解析エラー: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    # 出力ファイルパス
    json_output = os.path.join(output_dir, 'hazardMatrix.json')
    js_output = os.path.join(output_dir, 'hazardMatrix.js')
    
    # JSON出力
    try:
        save_json(hazard_matrix, json_output)
    except Exception as e:
        print(f"[ERROR] JSON出力エラー: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    # JS出力
    try:
        save_js(hazard_matrix, js_output)
    except Exception as e:
        print(f"[ERROR] JS出力エラー: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    # 結果表示
    print("\n" + "="*70)
    print("生成完了")
    print("="*70)
    print(f"JSON: {json_output}")
    print(f"JS:   {js_output}")
    print(f"レイヤー数: {len(hazard_matrix)}")
    print("="*70)
    
    # 内容プレビュー（最初の3エントリ）
    print("\n[プレビュー] hazardMatrix.json の最初の3エントリ:")
    print("-"*70)
    preview_count = 0
    for key, value in hazard_matrix.items():
        if preview_count >= 3:
            break
        print(f"\n{key}:")
        print(json.dumps(value, ensure_ascii=False, indent=2))
        preview_count += 1
    
    if len(hazard_matrix) > 3:
        print(f"\n... 他 {len(hazard_matrix) - 3} エントリ")
    
    print("\n" + "="*70)
    print("全データの確認は生成されたファイルを参照してください")
    print("="*70)


if __name__ == '__main__':
    main()
