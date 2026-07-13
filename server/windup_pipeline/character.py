"""角色卡（Character Card）—— 一致性主键 + 资产库基础。

产品 §2.8 的核心实体：把"每次靠易失提示词描述角色"固化为结构化卡片 + 基准帧，
一致性从"靠运气"变成"有约束"，并给自动质检提供判据。支持续生成/版本。
"""
import os, json, time
from dataclasses import dataclass, field, asdict


@dataclass
class CharacterCard:
    name: str
    desc: str                      # 身份描述（喂模型锁一致性）
    palette: str = ""              # 主配色（质检参考）
    view: str = "pseudo-side"      # 视角：pseudo-side / profile / front
    base_frame: str = ""           # 选定基准帧路径
    ref_image: str = ""            # 用户原始参考图
    version: str = "v1"
    parent_version: str | None = None
    created_ts: float = field(default_factory=lambda: time.time())

    def dir(self, outroot="characters"):
        return os.path.join(outroot, self.name)

    def save(self, outroot="characters"):
        d = self.dir(outroot); os.makedirs(d, exist_ok=True)
        p = os.path.join(d, "card.json")
        json.dump(asdict(self), open(p, "w"), indent=2, ensure_ascii=False)
        return p

    @staticmethod
    def load(name, outroot="characters"):
        p = os.path.join(outroot, name, "card.json")
        if not os.path.exists(p):
            return None
        return CharacterCard(**json.load(open(p)))

    def bump_version(self, note=""):
        """改形象 → 生成新版卡（旧版保留，已生成动作不受影响）。"""
        n = int(self.version.lstrip("v") or 1) + 1
        self.parent_version, self.version = self.version, f"v{n}"
        self.created_ts = time.time()
        return self
