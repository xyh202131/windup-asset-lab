"""⑤ 抠图去背：rembg（u2net）AI 主体分割。

关键：用 AI 按"主体"抠，不按颜色抠 —— 骨白/绿袍等角色不会被同色背景抠穿。
"""
from PIL import Image

_session = None


def _get_session():
    global _session
    if _session is None:
        from rembg import new_session
        _session = new_session("u2net")
    return _session


def cutout(in_path, out_path):
    """去背景，输出透明 PNG。"""
    from rembg import remove
    im = Image.open(in_path).convert("RGBA")
    remove(im, session=_get_session()).save(out_path)
    return out_path


def kill_ground_shadow(im):
    """去掉脚下残留灰椭圆阴影（底部 18% 内、低饱和中灰的连通块）。"""
    from collections import deque
    im = im.convert("RGBA"); px = im.load(); w, h = im.size

    def is_shadow(x, y):
        r, g, b, a = px[x, y]
        if a < 8:
            return False
        mx, mn = max(r, g, b), min(r, g, b)
        return (mx - mn) <= 30 and 120 <= mn <= 225

    band = int(h * 0.82); seen = [[False]*w for _ in range(h)]; dq = deque()
    for y in range(band, h):
        for x in range(w):
            if is_shadow(x, y) and not seen[y][x]:
                seen[y][x] = True; dq.append((x, y))
    while dq:
        x, y = dq.popleft(); px[x, y] = (px[x, y][0], px[x, y][1], px[x, y][2], 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, 1), (1, -1), (-1, -1)):
            nx, ny = x+dx, y+dy
            if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and is_shadow(nx, ny):
                seen[ny][nx] = True; dq.append((nx, ny))
    return im
