"""生成清河镇的初始布局 art/town/qinghe.json（之后用游戏里的场景编辑器改，导出的 JSON 直接覆盖这个文件）。
用法：python3 tools/gen_town.py
布局：东西向一条主街（z = -3 ~ 3），中间一个方砖小广场和一座红柱方亭；主街两边各 6 栋房子，门朝街；
西头是进镇的地方（主人从这里出生）；外面一圈树。"""
import json, os, random
R = random.Random(20261026)
items = []
def P(p, x, z, r=0, y=0, tint=None):
    it = {'p': p, 'x': x, 'z': z}
    if r: it['r'] = r
    if y: it['y'] = y
    if tint: it['tint'] = tint
    items.append(it)
def A(a, x, z, r=0):
    it = {'a': a, 'x': x, 'z': z}
    if r: it['r'] = r
    items.append(it)

# 主街：2×2 石板路，三种排列随机，随机转 0/90/180/270 让花纹不重复
for x in range(-37, 38, 2):
    for z in (-2, 0, 2):
        if -7 < x < 7: continue
        P(R.choice(['kit_path_stone_2x2_a', 'kit_path_stone_2x2_b', 'kit_path_stone_2x2_c']), x, z, R.choice([0, 90, 180, 270]))
# 小广场：方砖 14×14 m
for x in range(-7, 8, 2):
    for z in range(-7, 8, 2):
        P('kit_floor_tile_2x2', x, z)
# 方亭：4 块台基 + 四根红柱 + 攒尖顶 + 四面台阶
for x in (-1, 1):
    for z in (-1, 1):
        P('kit_found_stone_2x2', x, z)
for x in (-1.75, 1.75):
    for z in (-1.75, 1.75):
        P('kit_column_red', x, z, y=0.4)
P('kit_roof_pyramid_4m_t', 0, 0, y=2.8, tint='roof')
for r, (x, z) in ((0, (0, 2.3)), (90, (2.3, 0)), (180, (0, -2.3)), (270, (-2.3, 0))):
    P('kit_step_stone_2m', x, z, r)
# 广场四角的长椅、木桶
for x, z, r in ((-5.5, -5.5, 45), (5.5, -5.5, 315), (-5.5, 5.5, 135), (5.5, 5.5, 225)):
    P('kit_prop_bench', x, z, r)
for x, z in ((-6.4, -3.6), (6.4, 3.6), (-6.4, 4.2), (6.6, -4.0)):
    P('kit_prop_barrel_a', x, z, R.choice([0, 30, 60]))
# 房子：北边门朝南（r=0，正面朝 +Z），南边门朝北（r=180）
kinds = ['farmhouse_s3_porch', 'sample_house_4x4', 'farmhouse_s1_thatch']
k = 0
for side, z, r in (('n', -9, 0), ('s', 9, 180)):
    for x in (-31, -23, -15, 15, 23, 31):
        A(kinds[k % 3], x, z, r); k += 1
        # 房子旁边一只木桶
        P('kit_prop_barrel_a', x + 3.2, z + (2.2 if r == 0 else -2.2), R.choice([0, 40, 80]))
# 房子之间的矮院墙（两栋之间、靠后）
for side, z in (('n', -12), ('s', 12)):
    for x in (-27, -19, 19, 27):
        for dx in (-1, 1):
            P('kit_wall_half_2m', x + dx, z)
# 树：镇子外圈 + 房子后面
trees = []
for i in range(70):
    import math
    a = i / 70 * math.pi * 2 + R.random() * 0.08; d = 46 + R.random() * 12
    trees.append([round(math.cos(a) * d, 1), round(math.sin(a) * d * 0.75, 1), round(0.9 + R.random() * 0.6, 2)])
for x in (-35, -27, -19, -11, 11, 19, 27, 35):
    for z in (-16, 16):
        trees.append([x + round(R.uniform(-1.5, 1.5), 1), z + round(R.uniform(-1.5, 1.5), 1), round(0.8 + R.random() * 0.5, 2)])
for x, z in ((-10, -5), (10, 5), (-10, 5), (10, -5)):
    trees.append([x, z, 0.8])
out = {'name': '清河镇', 'version': 1, 'spawn': [-40, 0, round(math.pi / 2, 4)],
       'assemblies': kinds, 'items': items, 'trees': trees,
       'note': '由 tools/gen_town.py 生成；之后用游戏里的场景编辑器（网址加 ?edit=1）修改，导出的 JSON 覆盖本文件'}
p = os.path.join(os.path.dirname(__file__), '..', 'art', 'town', 'qinghe.json'); os.makedirs(os.path.dirname(p), exist_ok=True)
json.dump(out, open(p, 'w'), ensure_ascii=False, indent=0)
print(len(items), '件，', len(trees), '棵树 →', p)
