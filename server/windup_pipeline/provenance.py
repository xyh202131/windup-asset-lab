"""生成溯源与成本记录（GenerationRun）—— 产品 §2.8 实体。

每次生成追加一条记录到 characters/<name>/provenance.jsonl：
prompt/路线/模型/seed/次数/耗时/成本/AIGC 标识 —— 支撑可复现、成本核算、合规。
"""
import os, json, time

# 成本估算（按输出图像 token 折算；实际单价以服务商控制台为准）
YUAN_PER_IMAGE = 0.28   # ≈ gemini flash-image 单张（估算）


def record(name, action, frame_idx, prompt, model, route="A",
           seed=None, attempts=1, elapsed_s=0.0, outroot="characters"):
    d = os.path.join(outroot, name); os.makedirs(d, exist_ok=True)
    row = {
        "ts": time.time(), "action": action, "frame": frame_idx,
        "prompt": prompt[:200], "model": model, "route": route,
        "seed": seed, "attempts": attempts, "elapsed_s": round(elapsed_s, 1),
        "cost_yuan_est": round(YUAN_PER_IMAGE * attempts, 3),
        "aigc_label": "AI-generated",
    }
    with open(os.path.join(d, "provenance.jsonl"), "a") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")
    return row


def summary(name, outroot="characters"):
    """汇总一个角色的总生成次数与成本。"""
    p = os.path.join(outroot, name, "provenance.jsonl")
    if not os.path.exists(p):
        return {"runs": 0, "cost_yuan_est": 0.0}
    rows = [json.loads(l) for l in open(p) if l.strip()]
    return {"runs": len(rows),
            "cost_yuan_est": round(sum(r.get("cost_yuan_est", 0) for r in rows), 2),
            "total_elapsed_s": round(sum(r.get("elapsed_s", 0) for r in rows), 1)}
