"""单帧重生成 —— 产品核心卖点。

坏哪帧只重生成那一帧，不动其他帧；重生成后只对该动作重新对齐+打包。
这是"逐帧生成"路线相对"视频转帧/3D 渲帧"的关键优势（那两种帧耦合、改一帧动全身）。
"""
import os
from . import character, actions, generate, matte, align, pack, provenance, config


def regenerate_frame(name, action_name, frame_idx, outroot="characters",
                     custom_poses=None, extra_hint=""):
    """重生成 <name> 的 <action_name> 第 frame_idx 帧（0-based）。"""
    card = character.CharacterCard.load(name, outroot)
    if not card:
        raise SystemExit(f"角色卡不存在：{name}（先跑 run.py 生成）")
    act = actions.get(action_name, custom_poses)
    if not (0 <= frame_idx < act.n_frames):
        raise SystemExit(f"帧号越界：{action_name} 只有 {act.n_frames} 帧")

    root = card.dir(outroot)
    d_raw = os.path.join(root, f"02_{action_name}_raw")
    d_cut = os.path.join(root, f"03_{action_name}_cutout")
    d_out = os.path.join(root, "04_output")

    # 只重生成这一帧的原图
    pose = act.poses[frame_idx] + ("; " + extra_hint if extra_hint else "")
    raw = os.path.join(d_raw, f"{action_name}_{frame_idx:02d}.png")
    print(f"重生成 {name}/{action_name} 帧 {frame_idx} ...")
    import time; t = time.time()
    if not generate.gen_frame(card.base_frame, card.desc, pose, raw):
        raise SystemExit("重生成失败（检查 SUFY_KEY / 网络）")
    provenance.record(name, action_name, frame_idx, pose, config.IMAGE_MODEL,
                      elapsed_s=time.time()-t, outroot=outroot)

    # 只重抠这一帧
    cut = os.path.join(d_cut, f"{action_name}_{frame_idx:02d}.png")
    matte.cutout(raw, cut)

    # 该动作全部帧重新对齐+打包（其他帧的原图/抠图不动，只是重新组装）
    cut_paths = sorted(os.path.join(d_cut, f) for f in os.listdir(d_cut) if f.endswith(".png"))
    frames = align.align_frames(cut_paths)
    _repack(d_out, action_name, frames)
    print(f"✅ 单帧重生成完成，其余 {len(frames)-1} 帧未改动")


def _repack(d_out, action_name, frames):
    os.makedirs(d_out, exist_ok=True)
    base = os.path.join(d_out, action_name)
    pack.sprite_sheet(frames, base + "_sheet.png")
    pack.write_json(len(frames), config.CELL, base + "_sheet.json", f"{action_name}_sheet.png")
    pack.write_plist(len(frames), config.CELL, base + "_sheet.plist", f"{action_name}_sheet.png")
    pack.gif(frames, base + ".gif",
             duration=int(1000 / actions.get(action_name).fps))
