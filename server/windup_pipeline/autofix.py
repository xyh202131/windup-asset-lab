"""自动修残次帧 —— 质检 + 单帧重生成 联动，不用人手动大改。

流程：生成一个动作后 → 跑对齐质检（可选 VLM 一致性）→ 对被标记的帧
自动单帧重生成，最多 max_rounds 轮，仍不合格则保留最好的并记录警告。
这就是"残次品能回退/自愈"的机制：坏哪帧自动重那帧，其它帧不动。
"""
import os
from . import qa, generate, matte, align, pack, provenance, config, actions


def autofix_action(card, act, outroot="characters", max_rounds=2, use_vlm=False):
    """对已生成的某动作跑质检并自动重生成坏帧。返回最终质检报告。"""
    root = card.dir(outroot)
    d_raw = os.path.join(root, f"02_{act.name}_raw")
    d_cut = os.path.join(root, f"03_{act.name}_cutout")
    d_out = os.path.join(root, "04_output")

    def cut_paths():
        return sorted(os.path.join(d_cut, f) for f in os.listdir(d_cut) if f.endswith(".png"))

    report = qa.run_qa(card.base_frame, cut_paths(), use_vlm=use_vlm)
    for rnd in range(max_rounds):
        bad = set(report["alignment"].get("drift_frames", []))
        if use_vlm:
            bad |= set(report.get("consistency_fail", []))
        if not bad:
            print(f"  ✓ 质检通过，无需修帧"); break
        print(f"  自动修帧 第{rnd+1}轮：重生成 {sorted(bad)}")
        for idx in sorted(bad):
            if idx >= act.n_frames:
                continue
            raw = os.path.join(d_raw, f"{act.name}_{idx:02d}.png")
            import time; t = time.time()
            if generate.gen_frame(card.base_frame, card.desc, act.poses[idx], raw):
                provenance.record(card.name, act.name, idx, act.poses[idx],
                                  config.IMAGE_MODEL, elapsed_s=time.time()-t, outroot=outroot)
                matte.cutout(raw, os.path.join(d_cut, f"{act.name}_{idx:02d}.png"))
        report = qa.run_qa(card.base_frame, cut_paths(), use_vlm=use_vlm)

    # 用（可能已修过的）帧重新对齐 + 打包
    frames = align.align_frames(cut_paths())
    base = os.path.join(d_out, act.name)
    pack.sprite_sheet(frames, base + "_sheet.png")
    pack.write_json(len(frames), config.CELL, base + "_sheet.json", f"{act.name}_sheet.png")
    pack.write_plist(len(frames), config.CELL, base + "_sheet.plist", f"{act.name}_sheet.png")
    pack.write_godot_tres(len(frames), config.CELL, base + "_sheet.tres", f"{act.name}_sheet.png")
    pack.gif(frames, base + ".gif", duration=int(1000/act.fps))
    report["fixed_rounds"] = rnd + 1 if 'rnd' in dir() else 0
    report["final_drift"] = report["alignment"].get("drift_frames", [])
    return report
