"""动作清单（Action Registry）—— 多动作而非只 walk。

每个动作定义：帧数、帧率、循环模式、逐帧姿势描述。
标准动作内置模板；自定义动作用户传 poses 即可（产品：清单可定制，非固定菜单）。
"""
from dataclasses import dataclass, field


@dataclass
class Action:
    name: str
    fps: int
    loop: str                     # none / linear / pingpong
    poses: list[str]              # 每帧姿势描述（帧数 = len(poses)）

    @property
    def n_frames(self):
        return len(self.poses)


# 内置标准动作（side/pseudo-side 横版）
STANDARD = {
    "idle": Action("idle", 8, "linear", [
        "standing at rest, weight centered, subtle breathing, arms/props relaxed",
        "very slight downward settle, shoulders lower a touch",
        "lowest point of the idle bob, chest compressed slightly",
        "starting to rise back, shoulders lifting",
        "near neutral again, tiny sway",
        "slight upward drift, breathing in",
        "highest point of idle bob, chest expanded",
        "settling back toward neutral to loop",
    ]),
    "walk": Action("walk", 10, "linear", [
        "WALK CYCLE frame 1/8, CONTACT pose: RIGHT leg extended forward with heel touching ground, "
        "LEFT leg extended behind pushing off, legs in widest stride split, arms swinging (left arm forward), "
        "torso upright and calm, walking to the right — NOT running, NOT posing, NOT reaching",
        "WALK CYCLE frame 2/8, DOWN pose: right foot flat on ground taking weight, body at lowest point, "
        "left leg starting to lift behind, legs closer than frame 1, natural relaxed walk",
        "WALK CYCLE frame 3/8, PASSING pose: left leg swinging forward passing directly under the body, "
        "right leg vertical supporting all weight, legs close together, body at neutral height",
        "WALK CYCLE frame 4/8, UP pose: left leg reaching forward, body at highest point rising on right toe, "
        "about to plant left foot, mild stride opening",
        "WALK CYCLE frame 5/8, opposite CONTACT: LEFT leg extended forward heel down, RIGHT leg behind pushing off, "
        "widest stride (mirror of frame 1), right arm forward, calm walk to the right",
        "WALK CYCLE frame 6/8, DOWN pose: left foot flat taking weight, body lowest, right leg lifting behind, "
        "legs closing",
        "WALK CYCLE frame 7/8, PASSING pose: right leg swinging forward under the body, left leg vertical supporting, "
        "legs close together, neutral height",
        "WALK CYCLE frame 8/8, UP pose: right leg reaching forward returning toward frame 1, body rising on left toe",
    ]),
    "attack": Action("attack", 12, "none", [
        "wind-up: weapon/staff drawn back, weight loaded on back foot",
        "anticipation: body coiled, arm cocked",
        "swing start: weapon accelerating forward",
        "mid-swing: weapon at horizontal, body rotating",
        "impact: weapon fully extended forward, weight on front foot",
        "follow-through: weapon past target, body committed",
        "recovery: pulling weapon back, regaining balance",
        "return to neutral stance",
    ]),
    "jump": Action("jump", 10, "none", [
        "crouch: knees bent, gathering power, arms back",
        "launch: legs extending, pushing off ground",
        "rising: body stretched upward, feet leaving ground",
        "apex: highest point, body compact, limbs tucked",
        "falling: body extending downward, preparing to land",
        "landing: knees bending to absorb impact",
    ]),
}


def get(name, custom_poses=None, fps=10, loop="none"):
    """取动作。标准动作直接取；自定义动作传 custom_poses。"""
    if custom_poses:
        return Action(name, fps, loop, custom_poses)
    if name not in STANDARD:
        raise KeyError(f"未知标准动作 {name}；自定义请传 custom_poses")
    return STANDARD[name]
