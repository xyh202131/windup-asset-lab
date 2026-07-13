"""① 视角规整 + ④ 逐帧生成：调图像 API（OpenAI 兼容 /chat/completions）。

- 参考图 + 文字约束 → 生成图（route A：保"单帧可独立重画"）。
- key 从环境变量读（见 config.py）。
"""
import base64, re
from . import config


def _call(text, ref_paths, out_path, timeout=200):
    """底层调用：text + 若干参考图 → 生成一张图存到 out_path。返回 bool。
    网络重试由 config.post_json 统一处理；这里再对'调用成功但没返回有效图'多试几轮。"""
    content = [{"type": "text", "text": text}]
    for p in ref_paths:
        b = base64.b64encode(open(p, "rb").read()).decode()
        content.append({"type": "image_url",
                         "image_url": {"url": "data:image/png;base64," + b}})
    body = {"model": config.IMAGE_MODEL,
            "messages": [{"role": "user", "content": content}]}
    for attempt in range(3):                      # 空图重试（内含网络重试）
        try:
            res = config.post_json("/chat/completions", body, timeout=timeout)
        except Exception as e:
            print(f"    · 生成失败（网络）：{str(e)[:70]}"); return False
        m = re.search(r'data:image/[^;]+;base64,([A-Za-z0-9+/=]{100,})', __import__("json").dumps(res))
        if m:
            data = base64.b64decode(m.group(1))
            if len(data) > 5000:
                open(out_path, "wb").write(data); return True
        print(f"    · 返回无有效图，重试 {attempt+1}/3")
    return False


def to_side_view(ref_path, char_desc, out_path):
    """① 把任意视角角色转成伪侧面(3/4)基准帧。char_desc: 角色身份描述。"""
    txt = (f"Convert the character in the reference to a PSEUDO-SIDE (3/4) view facing RIGHT, "
           f"full body, standing. Keep the EXACT same identity and art style: {char_desc}. "
           f"{config.BG_MAGENTA}. {config.NO_SHADOW}. Character centered, full body head-to-feet.")
    return _call(txt, [ref_path], out_path)


def gen_frame(base_path, char_desc, pose_desc, out_path, skeleton_path=None):
    """④ 生成一帧动作。base_path=角色基准帧；pose_desc=该帧姿势；
    skeleton_path 可选：给一张骨架条件图做姿势约束。"""
    txt = (f"Using the reference as exact identity and scale, redraw {char_desc}. "
           f"Pose for THIS frame: {pose_desc}. "
           f"{config.BG_MAGENTA}. {config.NO_SHADOW}. "
           f"identical scale and vertical position, feet on same ground line.")
    refs = [base_path] + ([skeleton_path] if skeleton_path else [])
    if skeleton_path:
        txt = ("TWO reference images. Image 1 = character identity/scale. "
               "Image 2 = OpenPose skeleton for the exact pose. " + txt)
    return _call(txt, refs, out_path)
