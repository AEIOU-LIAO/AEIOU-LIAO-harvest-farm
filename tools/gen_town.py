"""生成清河镇的初始布局 art/town/qinghe.json（之后用游戏里的场景编辑器改，导出的 JSON 直接覆盖这个文件）。
用法：python3 tools/gen_town.py
布局：东西向一条主街（z = -3 ~ 3），中间一个方砖小广场和一座红柱方亭；主街两边各 6 栋房子，门朝街，房前屋后摆着杂物，屋后一道木栅栏；广场南北是集市摊位；
西头是进镇的地方（主人从这里出生）；外面一圈树。"""
import json, os, random, math
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
for x in range(-41, 42, 2):
    for z in (-2, 0, 2):
        if -9 < x < 9: continue
        P(R.choice(['kit_path_stone_2x2_a', 'kit_path_stone_2x2_b', 'kit_path_stone_2x2_c']), x, z, R.choice([0, 90, 180, 270]))
# 小广场：方砖 18×18 m，中间是红栏杆方亭（美术示范组合）
for x in range(-9, 10, 2):
    for z in range(-9, 10, 2):
        P('kit_floor_tile_2x2', x, z)
A('square_pavilion_with_red_rail', 0, 0)
# 广场南北两边是集市摊位（组合：两个摊位并排），门面朝广场
A('market_stall', -2, -7.2, 0)
A('market_stall', 2, 7.2, 180)
# 摊位边上的货：木箱、麻袋、竹篮、陶罐
for (x, z, r) in ((-6.2, -6.2, 0), (6.2, 6.2, 180)):
    sg = 1 if r == 0 else -1
    P('kit_prop_crate_b', x, z, R.choice([0, 15, 30])); P('kit_prop_crate_a', x - 0.2 * sg, z - 1.0 * sg, R.choice([0, 20]))
    P('kit_prop_sack', x + 0.9 * sg, z - 0.4 * sg, R.choice([0, 40])); P('kit_prop_basket', x + 0.8 * sg, z + 0.6 * sg)
    P('kit_prop_jar_large', -x * 0.98, z, 0); P('kit_prop_jar_small', -x * 0.98 + 0.6 * sg, z + 0.4 * sg)
# 广场四角的长椅、花盆
for x, z, r in ((-7.5, -2.5, 90), (7.5, 2.5, 270), (-7.5, 2.5, 90), (7.5, -2.5, 270)):
    P('kit_prop_bench', x, z, r)
for x, z in ((-8.4, -8.4), (8.4, -8.4), (-8.4, 8.4), (8.4, 8.4)):
    P('kit_prop_flowerpot', x, z)
# 街边石灯笼，每 8 米一盏
for x in (-37, -29, -21, -13, 13, 21, 29, 37):
    for z in (-3.7, 3.7):
        P('kit_prop_stone_lantern', x, z, 0 if z < 0 else 180)
# 进镇的地方：两面幡旗
P('kit_banner', -42.5, -3.8, 90); P('kit_banner', -42.5, 3.8, 90)
# 房子：北边门朝南（r=0，正面朝 +Z），南边门朝北（r=180）
kinds = ['farmhouse_s3_porch', 'sample_house_4x4', 'farmhouse_s1_thatch']
k = 0
for side, z, r in (('n', -9.5, 0), ('s', 9.5, 180)):
    sg = 1 if r == 0 else -1
    for x in (-35, -27, -19, 19, 27, 35):
        kind = kinds[k % 3]; A(kind, x, z, r); k += 1
        P('kit_prop_barrel_a' if k % 2 else 'kit_prop_barrel_b', x + 3.2, z + 2.2 * sg, R.choice([0, 40, 80]))
        if kind == 'farmhouse_s1_thatch':   # 茅草屋旁边：草垛、柴堆、独轮车
            P('kit_prop_haybale', x - 3.6, z - 0.5 * sg, R.choice([0, 30])); P('kit_prop_woodpile', x + 3.4, z - 1.2 * sg, 90 if sg > 0 else 270); P('kit_prop_cart', x - 3.4, z + 2.2 * sg, R.choice([20, 60]))
        elif kind == 'sample_house_4x4':
            P('kit_prop_planter', x - 3.2, z + 1.8 * sg, 90); P('kit_prop_toolrack', x + 3.3, z - 1.0 * sg, 90 if sg > 0 else 270)
        else:
            P('kit_prop_table', x - 3.4, z + 2.4 * sg); P('kit_prop_stool', x - 3.4, z + 3.3 * sg); P('kit_prop_bucket', x + 3.6, z + 3.0 * sg)
# 房子后面的木栅栏（一段 2 米，段与段之间立桩）
for z in (-13.6, 13.6):
    for xs, xe in ((-40, -14), (14, 40)):
        for x in range(xs, xe, 2):
            P('kit_fence_wood_2m', x + 1, z, 0 if z < 0 else 180)
        for x in range(xs, xe + 1, 2):
            P('kit_fence_wood_post', x, z)
# 树：镇子外圈 + 房子后面
trees = []
for i in range(70):
    import math
    a = i / 70 * math.pi * 2 + R.random() * 0.08; d = 52 + R.random() * 12
    trees.append([round(math.cos(a) * d, 1), round(math.sin(a) * d * 0.75, 1), round(0.9 + R.random() * 0.6, 2)])
for x in (-39, -31, -23, -15, 15, 23, 31, 39):
    for z in (-17, 17):
        trees.append([x + round(R.uniform(-1.5, 1.5), 1), z + round(R.uniform(-1.0, 1.0), 1), round(0.8 + R.random() * 0.5, 2)])
for x, z in ((-11.5, -6), (11.5, 6), (-11.5, 6), (11.5, -6)):
    trees.append([x, z, 0.8])
out = {'name': '清河镇', 'version': 1, 'spawn': [-45, 0, round(math.pi / 2, 4)],
       'assemblies': kinds + ['market_stall', 'square_pavilion_with_red_rail', 'fence_gate', 'dock_and_arch_bridge'], 'items': items, 'trees': trees,
       'note': '由 tools/gen_town.py 生成；之后用游戏里的场景编辑器（网址加 ?edit=1）修改，导出的 JSON 覆盖本文件'}
p = os.path.join(os.path.dirname(__file__), '..', 'art', 'town', 'qinghe.json'); os.makedirs(os.path.dirname(p), exist_ok=True)
json.dump(out, open(p, 'w'), ensure_ascii=False, indent=0)
print(len(items), '件，', len(trees), '棵树 →', p)
