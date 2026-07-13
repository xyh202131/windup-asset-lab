"""⑥ 逐帧对齐：按脚底线 + 躯干中心锚点对齐，消除画布漂移。

躯干中心只取上半身（头+胸）质心，避开剑/法杖/裙摆等延展物，
否则包围盒被撑大导致身体左右横跳。
"""
from PIL import Image
from . import config


def anchor(im, alpha_th=150):
    """返回 (脚底y, 躯干中心x)。"""
    px = im.load(); w, h = im.size
    ys = [y for y in range(h) if any(px[x, y][3] > alpha_th for x in range(0, w, 2))]
    if not ys:
        return None
    top, bot = min(ys), max(ys); Hc = bot - top
    y0, y1 = top + int(Hc * 0.08), top + int(Hc * 0.45)   # 头+胸带
    xs = [x for y in range(y0, y1) for x in range(w) if px[x, y][3] > alpha_th]
    return bot, (sum(xs) / len(xs) if xs else w / 2)


def align_frames(cutout_paths, cell=None):
    """把若干抠图帧对齐到统一画布，返回 [PIL.Image(cell×cell)]。"""
    cell = cell or config.CELL
    imgs = [Image.open(p).convert("RGBA") for p in cutout_paths]
    out = []
    for im in imgs:
        a = anchor(im)
        if not a:
            out.append(im.resize((cell, cell))); continue
        bot, cx = a
        big = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
        big.alpha_composite(im, (int(512 - cx), int(int(1024 * config.FOOT_RATIO) - bot)))
        out.append(big.resize((cell, cell), Image.LANCZOS))
    return out
