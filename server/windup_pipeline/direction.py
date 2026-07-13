"""[EXPERIMENTAL · 未完成] 动作方向一致性 —— 北极星"一致性+方向"的直接落点。

⚠️ 现状：VLM 判朝向（facing_vlm）实测不可靠——把已知朝左的帧也判成 right，
   无法可靠揪出方向不一致帧。facing_cv 纯 CV 法也粗糙。
   待改进：改用"每帧 vs 其水平镜像 的互相似度 + 组内多数投票"来定朝向。
   暂勿用于自动流程；手动翻转（enforce 的翻转+备份逻辑）本身是对的。

动作方向一致性 —— 北极星"一致性+方向"的直接落点。

一组动作帧应朝同一方向。本模块：
  1. 检测每帧朝向（VLM 判 left/right，可靠；或纯 CV 镜像相似度做离线兜底）；
  2. 找出与多数方向不一致的帧；
  3. 一键把异类帧水平翻转对齐到多数方向（保留 .orig 备份）。

这是我们做得又快又好、竞品不做的"最后一公里"能力之一。
"""
import os, glob, base64, json, re
from PIL import Image
from . import config


def facing_vlm(path, model=None):
    """用视觉模型判该帧朝向：返回 'left' / 'right' / None。"""
    model = model or config.VLM_MODEL
    b = base64.b64encode(open(path, "rb").read()).decode()
    prompt = ('Which way is this side-view game character facing? '
              'Answer STRICT JSON: {"facing": "left" or "right"}. '
              'Judge by the direction the face/nose/front of the body points.')
    body = {"model": model, "messages": [{"role": "user", "content": [
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": "data:image/png;base64," + b}}]}]}
    try:
        res = config.post_json("/chat/completions", body, timeout=90)
        m = re.search(r'\{.*\}', res["choices"][0]["message"]["content"], re.S)
        if m:
            return json.loads(m.group(0)).get("facing")
    except Exception as e:
        print(f"    · 朝向判定失败 {os.path.basename(path)}: {str(e)[:60]}")
    return None


def facing_cv(path):
    """纯 CV 兜底：不透明像素与其水平镜像的差异分布偏向哪侧。粗略，仅离线用。"""
    im = Image.open(path).convert("RGBA"); px = im.load(); w, h = im.size
    # 上半身左右两半的不透明面积差（脸/身体朝向那侧通常更"实"）
    ys = [y for y in range(h) if any(px[x, y][3] > 80 for x in range(0, w, 2))]
    if not ys:
        return None
    top = min(ys); y1 = top + int((max(ys) - top) * 0.4)
    xs = [x for y in range(top, y1) for x in range(w) if px[x, y][3] > 80]
    if not xs:
        return None
    mid = (min(xs) + max(xs)) / 2
    l = sum(1 for x in xs if x < mid); r = len(xs) - l
    return "right" if r >= l else "left"


def enforce(frame_paths, use_vlm=True):
    """把一组帧统一到多数方向，异类翻转。返回 {majority, flipped:[...]}"""
    judge = facing_vlm if use_vlm else facing_cv
    dirs = {p: judge(p) for p in frame_paths}
    known = [d for d in dirs.values() if d]
    if not known:
        return {"majority": None, "flipped": [], "note": "无法判定朝向"}
    from collections import Counter
    majority = Counter(known).most_common(1)[0][0]
    flipped = []
    for p, d in dirs.items():
        if d and d != majority:
            Image.open(p).convert("RGBA").save(p.replace(".png", ".orig.png"))  # 备份
            Image.open(p).convert("RGBA").transpose(Image.FLIP_LEFT_RIGHT).save(p)
            flipped.append(os.path.basename(p))
    return {"majority": majority, "flipped": flipped}
