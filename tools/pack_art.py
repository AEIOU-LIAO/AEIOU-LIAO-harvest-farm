"""把美术交付的 GLB 处理成网页用的版本：
1. 去掉内嵌图片（贴图改为单独 jpg 加载，手机微信浏览器解码内嵌图片会报错）；
2. 压缩二进制数据，去掉图片占用的空间；
3. 另存一份 gzip 版（.glb.gz），网页用 DecompressionStream 解压，体积约 1/4。
用法：python3 tools/pack_art.py <美术仓库的 GLB> <输出目录> [--mobile 1024]
  不加 --mobile：tex/ 下原样导出贴图；加 --mobile N：tex/ 为手机版（缩到 N），tex2k/ 为原尺寸高清版，全部转 JPEG。"""
import json, struct, sys, os, gzip, io

def read(p):
    b = open(p, 'rb').read(); assert b[:4] == b'glTF'; off = 12; J = BIN = None
    while off < len(b):
        ln, ty = struct.unpack('<II', b[off:off + 8]); ch = b[off + 8:off + 8 + ln]; off += 8 + ln
        if ty == 0x4E4F534A: J = json.loads(ch)
        elif ty == 0x004E4942: BIN = ch
    return J, BIN

def write(J, BIN):
    js = json.dumps(J, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4); BIN += b'\0' * ((4 - len(BIN) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(BIN)
    return struct.pack('<III', 0x46546C67, 2, total) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(BIN), 0x004E4942) + BIN

def pack(src, out_dir, mobile=0):
    J, BIN = read(src); name = os.path.splitext(os.path.basename(src))[0]
    os.makedirs(os.path.join(out_dir, 'tex'), exist_ok=True)
    img_views = set()
    for im in J.get('images', []):
        bv = J['bufferViews'][im['bufferView']]; img_views.add(im['bufferView'])
        data = BIN[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
        if not mobile: open(os.path.join(out_dir, 'tex', im['name'] + '.jpg'), 'wb').write(data); continue
        from PIL import Image
        img = Image.open(io.BytesIO(data)).convert('RGB'); q = 92 if 'normal' in im['name'] else 85
        os.makedirs(os.path.join(out_dir, 'tex2k'), exist_ok=True)
        if im.get('mimeType') == 'image/jpeg': open(os.path.join(out_dir, 'tex2k', im['name'] + '.jpg'), 'wb').write(data)
        else: img.save(os.path.join(out_dir, 'tex2k', im['name'] + '.jpg'), quality=q, optimize=True)
        small = img.resize((mobile, mobile), Image.LANCZOS) if img.width > mobile else img
        small.save(os.path.join(out_dir, 'tex', im['name'] + '.jpg'), quality=q, optimize=True)
    # 材质只保留名字和参数，贴图引用去掉（运行时按「材质 → 图片名」从 tex/ 加载），图片名写进 extras 方便查
    for m in J.get('materials', []):
        ex = m.setdefault('extras', {})
        pbr = m.get('pbrMetallicRoughness', {})
        for key, holder in [('baseColorTexture', pbr), ('metallicRoughnessTexture', pbr), ('normalTexture', m), ('occlusionTexture', m), ('emissiveTexture', m)]:
            if key in holder:
                ex[key] = J['images'][J['textures'][holder[key]['index']]['source']]['name']
                if key == 'occlusionTexture' and 'strength' in holder[key]: ex['aoStrength'] = holder[key]['strength']
                del holder[key]
    for k in ('images', 'textures', 'samplers'): J.pop(k, None)
    # 重新排列 bufferView，去掉图片数据
    new_views, remap, nb = [], {}, bytearray()
    for i, bv in enumerate(J['bufferViews']):
        if i in img_views: continue
        data = BIN[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
        while len(nb) % 4: nb += b'\0'
        nv = dict(bv); nv['byteOffset'] = len(nb); nb += data; remap[i] = len(new_views); new_views.append(nv)
    for ac in J['accessors']:
        if 'bufferView' in ac: ac['bufferView'] = remap[ac['bufferView']]
        sp = ac.get('sparse')
        if sp: sp['indices']['bufferView'] = remap[sp['indices']['bufferView']]; sp['values']['bufferView'] = remap[sp['values']['bufferView']]
    J['bufferViews'] = new_views; J['buffers'] = [{'byteLength': len(nb)}]
    glb = write(J, bytes(nb))
    open(os.path.join(out_dir, name + '.glb'), 'wb').write(glb)
    open(os.path.join(out_dir, name + '.glb.gz'), 'wb').write(gzip.compress(glb, 9, mtime=0))
    print(name, '原始', os.path.getsize(src), '→ 去图', len(glb), '→ gzip', os.path.getsize(os.path.join(out_dir, name + '.glb.gz')))

if __name__ == '__main__':
    mob = int(sys.argv[sys.argv.index('--mobile') + 1]) if '--mobile' in sys.argv else 0
    pack(sys.argv[1], sys.argv[2], mob)
