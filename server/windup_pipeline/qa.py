"""自动质检（QA）—— 产品差异化能力（§3.4）。

两类检查：
  A. 对齐漂移（纯 CV，免费）：跨帧脚底线 / 躯干中心的方差，超阈值标记漂移帧。
  B. 一致性（VLM，需 API）：把每帧和基准帧喂视觉模型，判"是否同一角色"。
不合格帧 → 建议单帧重生成（regenerate）。
"""
import json, base64
from PIL import Image
from . import config, align


# ---------- A. 对齐漂移（纯 CV） ----------
def alignment_report(cutout_paths, foot_tol=6, cx_tol=12):
    """检查各帧脚底 y、躯干中心 x 的漂移。返回 {ok, frames:[{idx,foot,cx,drift}]}。"""
    rows = []
    foots, cxs = [], []
    for p in cutout_paths:
        im = Image.open(p).convert("RGBA")
        a = align.anchor(im)
        if a:
            foots.append(a[0]); cxs.append(a[1])
    if not foots:
        return {"ok": False, "reason": "no content"}
    foot_med = sorted(foots)[len(foots) // 2]
    cx_med = sorted(cxs)[len(cxs) // 2]
    bad = []
    for i, (f, c) in enumerate(zip(foots, cxs)):
        drift = abs(f - foot_med) > foot_tol or abs(c - cx_med) > cx_tol
        rows.append({"idx": i, "foot": round(f, 1), "cx": round(c, 1), "drift": drift})
        if drift:
            bad.append(i)
    return {"ok": not bad, "drift_frames": bad, "frames": rows,
            "foot_median": round(foot_med, 1), "cx_median": round(cx_med, 1)}


# ---------- B. 一致性（VLM） ----------
def vlm_consistency(base_path, frame_path, model=None):
    """问视觉模型：这两张是不是同一个角色？返回 {same:bool, notes:str}。"""
    config.require_key()
    model = model or config.VLM_MODEL
    def b64(p): return base64.b64encode(open(p, "rb").read()).decode()
    prompt = ("These are two frames of a game character. Image 1 is the reference (base). "
              "Image 2 is a generated animation frame. Answer STRICTLY as JSON: "
              '{"same_character": true/false, "issues": ["short notes on any drift in face/color/outfit/props/proportion"]}. '
              "Judge identity consistency, ignore pose differences.")
    body = {"model": model, "messages": [{"role": "user", "content": [
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": "data:image/png;base64," + b64(base_path)}},
        {"type": "image_url", "image_url": {"url": "data:image/png;base64," + b64(frame_path)}},
    ]}]}
    try:
        res = config.post_json("/chat/completions", body, timeout=120)   # 带重试
        txt = res["choices"][0]["message"]["content"]
        import re
        m = re.search(r'\{.*\}', txt, re.S)
        if m:
            j = json.loads(m.group(0))
            return {"same": bool(j.get("same_character")), "notes": j.get("issues", [])}
    except Exception as e:
        return {"same": None, "notes": [f"VLM error: {str(e)[:80]}"]}
    return {"same": None, "notes": ["unparseable VLM reply"]}


def run_qa(base_path, cutout_paths, use_vlm=False):
    """综合质检：对齐漂移 + 可选一致性。返回报告 dict。"""
    rep = {"alignment": alignment_report(cutout_paths)}
    if use_vlm:
        rep["consistency"] = [
            {"idx": i, **vlm_consistency(base_path, p)}
            for i, p in enumerate(cutout_paths)]
        rep["consistency_fail"] = [c["idx"] for c in rep["consistency"] if c["same"] is False]
    return rep
