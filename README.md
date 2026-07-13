# Windup Character Studio

> 从角色母版到 Cocos 可播资产的 2D 人物生成、审核与引擎验证工作台。

![Windup Asset Lab](reports/asset-lab-final.png)

Windup 面向国内小游戏独立开发者和微型团队：用户提供角色参考图或文字定义，系统生成成套动作，自动完成去背景、归一化、对齐、质检与打包，最后把“一组图”变成“放进 Cocos 就能播的角色”。

本仓库是可运行的端到端原型，而不只是静态编辑器。

## 现在可以做什么

- 在角色目录中切换、预览和审核多个像素角色。
- 按横屏侧视、俯视、2.5D 组织独立资产，缺口显式可见。
- 以固定 8 FPS 播放动作，支持逐帧、洋葱皮、自动巡走和键盘操控。
- 从本地生成中心发起整套 8 帧或单帧修复任务。
- 生成结果先进入候选区，人工确认后才覆盖正式资产，原帧自动备份。
- 在浏览器内执行 Alpha、脚底线、主体高度、质心位移、轮廓面积和循环接缝质检。
- 逐帧通过或退回，只有全部通过才解锁 Cocos 图集导出。
- 将当前角色、视角和动作同步到真实 Cocos Creator Web 运行时。

## 协作来源

本仓库与队友的 [johnnyzhang-eng/windup-pipeline](https://github.com/johnnyzhang-eng/windup-pipeline) 互补协作：

- `windup-pipeline` 提供角色母版、分帧生成、单帧重绘、对齐、质检、修复与溯源的 Python 实现路径。
- 本仓库把这条生成管线接入可视化产品界面，增加人工审核门禁、多角色资产库和 Cocos 联调。
- 仓库内 `Boy`、`Skeleton`、`Lirael` 演示角色来自队友管线产物，原始角色卡与 provenance 保留在 `artifacts/characters/`。
- `server/windup_pipeline/` 是为原型集成而内置的管线模块；后续建议改为固定版本的 package 依赖，保持双仓库清晰演进。

队友的横向 sprite sheet 必须按原始单元格精确切分，不能再次缩放或用系统裁图的居中偏移。仓库内置了无损适配器：

```bash
node tools/import-windup-sheet.js \
  /path/to/walk_sheet.png \
  assets/resources/characters/<character>/views/side \
  8 walk
```

## 产品流程

```mermaid
flowchart LR
  A["角色母版"] --> B["动作与视角规格"]
  B --> C["8 帧生成 / 单帧修复"]
  C --> D["去背景与 256×256 归一化"]
  D --> E["自动质检"]
  E --> F["候选区"]
  F --> G["逐帧人工审核"]
  G --> H["Cocos 图集 / 真实引擎播放"]
  G -."退回单帧".-> C
```

一致性不靠“多写几句提示词”，而是依靠一组可追溯约束：同一角色母版、固定角色描述、显式动作相位、统一脚底基线、局部重生和人工准入。

## 快速开始

### 1. 启动资产工作台

Python 3.11+ 并安装 Pillow：

```bash
python3 -m pip install -r server/requirements.txt
python3 server/app.py --demo
```

Demo 模式不调用外部 API，可用现有帧跑通完整任务。

真实生成时，密钥只进入后端进程：

```bash
SUFY_KEY="your-key" python3 server/app.py
```

可选环境变量：

| 变量 | 作用 | 默认值 |
|---|---|---|
| `SUFY_KEY` | OpenAI-compatible 图像 API 密钥 | 无 |
| `SUFY_BASE` | API Base URL | `https://openai.sufy.com/v1` |
| `SUFY_IMAGE_MODEL` | 图像生成模型 | `gemini-2.5-flash-image` |

### 2. 启动 Cocos 联调靶子

```bash
python3 -m http.server 4173 --bind 127.0.0.1 --directory build/lamplighter-mvp
```

| 入口 | 地址 |
|---|---|
| 角色资产工作台 | <http://127.0.0.1:4174/asset-lab/> |
| Cocos Web 运行时 | <http://127.0.0.1:4173/> |

## 生成任务模型

```text
POST /api/generations
  ├─ character: lamplighter | boy | skeleton | lirael
  ├─ view: side | topdown | isometric
  ├─ action: idle | walk | run | jump | lantern
  ├─ mode: full | single
  └─ frameIndex: 0..7

queued → generating → awaiting_review → approved
                              └─ failed
```

- 任务过程持久化在 `generation-data/jobs/`，默认不进入 Git。
- 正式采用前保留原帧到 `generation-data/backups/`。
- 运行时 provenance 记录模型、提示、耗时和生成方式。
- 前端永远无法读取 `SUFY_KEY`，网页部署不会携带密钥。

## 技术架构

| 层 | 实现 | 职责 |
|---|---|---|
| 交互层 | HTML / CSS / Vanilla JS | 角色目录、播放、逐帧审核、候选采用、图集导出 |
| 生成层 | Python `ThreadingHTTPServer` | 同源静态服务、安全 API 代理、后台任务、溯源与备份 |
| 处理层 | Pillow + Windup Pipeline | 固定背景去除、256×256 归一化、动作相位 |
| 质检层 | Canvas + Node tools | 几何连续性分析、CI 可用审计报告 |
| 引擎层 | Cocos Creator 3.8.8 | 真实 SpriteFrame 加载、8 FPS 播放、`postMessage` 联调 |

## 目录

```text
.
├─ asset-lab/                    # 角色生成、审核、质检与导出界面
├─ assets/
│  ├─ resources/character/      # 点灯少年正式资产
│  ├─ resources/characters/     # 队友管线的多角色资产
│  └─ scripts/GameRoot.ts       # Cocos 联调协议与运行时
├─ artifacts/characters/          # 角色卡和原始溯源
├─ server/
│  ├─ app.py                    # 安全后端、任务队列、候选采用
│  └─ windup_pipeline/          # 队友管线集成模块
├─ tools/                         # 切帧、扣图、归一化、动画审计
├─ build/lamplighter-mvp/         # 可部署的 Cocos Web 构建
├─ reports/                       # 质检结果与实测报告
├─ GAME_SPEC.md                   # 演示角色与 MVP 规格
└─ HANDOFF.md                     # 项目交接
```

## 质检边界

自动质检是第一道门，它能发现尺寸跳变、脚底漂移、主体面积突变和循环断层，但不能可靠判断“脚是否反了”、角色是否变脸、衣装细节是否走样。因此 Windup 保留三处人的决策：角色母版锁定、候选采用、逐帧通过。

## 安全与部署

- 不要把 API Key 写入前端、Cocos、`.env` 或 Git 记录。
- 静态网页可单独部署；需要真实生成时，同时部署 `server/app.py` 或将 `/api` 转发到等价后端。
- `build/lamplighter-mvp/` 可直接作为静态目录部署；工作台与 Cocos 跨域部署时需同步调整 `GAME_ORIGIN`。
- 生成任务目录可能包含用户参考图和提示，生产环境应配置访问控制、生命周期和对象存储。

## 当前缺口

- 俯视与 2.5D 的通用动作矩阵还未补齐。
- 任务状态仍是本地文件 + 内存索引，多实例部署需改为持久化队列。
- 去背景默认使用品红键色距离；生产版应接入 rembg 或模型 Alpha 输出。
- 模型成本、重试次数和质检分数还需进入统一的批次面板。

---

这个原型的核心不是“再做一个图片生成页”，而是让生成资产经过可修复、可审核、可追溯、可进引擎的完整产品链。
