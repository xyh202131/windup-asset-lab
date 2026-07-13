"""Windup 2D 角色动画素材生成管线。

模块：
  config        共享配置 + 环境变量读 API key
  generate      ① 视角规整 + ④ 逐帧生成（调图像 API）
  skeleton_gen  ③ 走路骨架序列生成
  matte         ⑤ rembg 抠图去背 + 去脚下阴影
  align         ⑥ 逐帧对齐（脚底/躯干锚点）
  pack          ⑦ 打包 sprite sheet + JSON/plist + GIF

编排见 run.py。
"""
