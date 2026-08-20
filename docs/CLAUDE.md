# 麻将消一消 · 项目说明书(给 Claude Code 的工作指引)

> 本文件是 Claude Code 的项目上下文说明,每次对话自动加载。
> 最后更新: 2026-08-18

---

## 一、项目概述

**项目名称**:麻将消一消(Mahjong Match-3)
**类型**:单机休闲消除手游
**核心玩法**:经典"上海麻将"类二消——点击两张相同花色且左右不被挡住的牌即可消除,特殊牌含暗牌(需翻面再消除)和吐牌机(消耗次数补充新牌)。底层采用 6 列 × 8 行的棋盘,多层 3D 堆叠(奇数层半格偏移)。
**当前阶段**:MVP 早期,重点是**批量关卡生产工具链**——关卡数量需求大(数百关),手工设计不现实。

---

## 二、双目录结构(核心!)

本项目有**两个目录**,职责不同,切勿混淆:

| 目录 | 角色 | 是否 git | 说明 |
|---|---|---|---|
| `麻将消一消/` | **主工作目录** | ❌ 不是 | 文档维护(工作日志/策划案/说明文档)在这里 |
| `麻将消一消_在线/` | **部署副本** | ✅ 是 | **直接在这里开发**,推送到 GitHub,部署到 Cloudflare Pages |

### 关系示意

```
麻将消一消/                    ← 文档维护(非 git)
├── 麻将消一消_工作日志.md     ← 工作日志"母本"(在这里编辑)
├── 策划案_编辑器工作台难度v2.md ← 策划案"母本"(在这里编辑)
├── 使用说明.md / 难度分说明.md / ...
└── outputs/                    ← 旧的,已废弃(不要在这里开发)

         ↓ 文档同步 ↓

麻将消一消_在线/               ← 部署副本(git 仓库,直接在这里开发)
├── editor/                    ← 在线编辑器(直接改这里)
│   ├── index.html             ← 编辑器页面
│   └── generator.js           ← 生成器 + 难度公式
├── workbench.html             ← 工作台
├── demo/                      ← 游戏 demo
├── docs/                      ← 文档(从主目录复制)
├── functions/                 ← Cloudflare Pages Function(API)
├── version.json               ← 版本检测
└── .git/                      ← remote: github.com/zhangjiwei0221/mahjong
```

---

## 三、工作流

### 3.1 开发(直接在部署副本)

```bash
# 直接编辑
cd "C:/Users/Administrator/Desktop/麻将消一消_在线"
# 修改 editor/index.html 或 editor/generator.js
```

### 3.2 文档维护(在主目录)

```bash
# 编辑工作日志/策划案
cd "C:/Users/Administrator/Desktop/麻将消一消"
# 编辑 麻将消一消_工作日志.md 或 策划案_编辑器工作台难度v2.md
```

### 3.3 同步文档到部署副本

```bash
cp "麻将消一消/麻将消一消_工作日志.md" "麻将消一消_在线/docs/工作日志.md"
cp "麻将消一消/策划案_编辑器工作台难度v2.md" "麻将消一消_在线/docs/策划案_编辑器工作台难度v2.md"
cp "麻将消一消/使用说明.md" "麻将消一消_在线/docs/使用说明.md"
cp "麻将消一消/难度分说明.md" "麻将消一消_在线/docs/难度分说明.md"
```

### 3.4 推送(部署到公网)

```bash
cd "麻将消一消_在线"
git add -A
git commit -m "描述"
git push origin main
```

### 3.5 版本号同步

每次推送后,同步更新两处:
- `麻将消一消_在线/version.json` 的 `version`(commit hash 前 7 位)
- `麻将消一消_在线/editor/index.html` 的 `window.APP_VERSION`

---

## 四、协作规范

### 4.1 工作日志更新

- **时机**:每次改动结束后,用户说"更新工作日志"时
- **格式**:`## Day X · 月.day(周X):一句话主题`
- **位置**:先在主目录编辑,同步到部署副本

### 4.2 变更日志与版本号

**版本号规则(三段式语义化版本)**:`v主版本.次版本.修订号`

| 变更类型 | 版本号变化 | 举例 |
|---|---|---|
| 重大变更 | 主版本 + 1 | v4.x → **v5.0** |
| 新增功能 | 次版本 + 1 | v4.3 → **v4.4** |
| 修复/小调整 | 修订号 + 1 | v4.3 → **v4.3.1** |

**变更日志位置**:`麻将消一消_在线/editor/index.html` 中的 `#changelogPop` 弹层

**⚠️ 重要规则:每次改动都必须更新变更日志!**

每次完成改动后,必须执行以下操作:
1. 在 `editor/index.html` 的 `#changelogPop` 弹层中追加一条新版本记录(最新的在最上面)
2. 同时更新 `version.json` 的 `version` 字段为 commit hash 前 7 位
3. 更新 `editor/index.html` 的 `window.APP_VERSION` 与 version.json 一致

**格式**:
```html
<div class="gh-item">
  <div class="gh-title">v4.3.1 · 2026-08-18</div>
  <div class="gh-desc">
    • 修复内容 1<br>
    • 修复内容 2
  </div>
</div>
```

### 4.3 双人协作注意

- 另一策划也在用这个工具 → 版本检测(version.json + APP_VERSION)会在新版本部署后提示强刷
- 数据(关卡 JSON)存在 GitHub `data/levels/`,两人共享
- 口令环境变量:`WORKBENCH_PASSWORD`(当前值 `1`)

---

## 五、当前进度(2026-08-18)

### 本地已提交但网络不通待推送

- 槽位压力维度 minSlots
- 钩子定义修正(双埋才算钩)
- 钩子加权改为可见伴侣加权
- 目标分数范围挪到顶部 + 单关生成也匹配分数范围
- 失败时返回最接近的关卡 + 显示偏差
- 撤销随机 seed(确定性生成)

### 待推送 commit(网络恢复后执行)

```bash
cd "麻将消一消_在线"
git push origin main
```

---

## 六、常见问题

**Q: 为什么有两个目录?**
A: 历史原因。主目录维护文档(非 git),部署副本是 git 仓库(直接开发这里)。

**Q: 工作日志/策划案在哪编辑?**
A: 主目录 `麻将消一消/`。编辑后复制到 `麻将消一消_在线/docs/`。

**Q: 编辑器在哪开发?**
A: 直接改 `麻将消一消_在线/editor/` 下的文件。旧的 `outputs/关卡搭建工具包/` 已废弃。

**Q: 推送前要做什么?**
A: 开发完成 → git add/commit/push → 更新 version.json + APP_VERSION。

**Q: 网络不通怎么办?**
A: commit 会留在本地,网络恢复后 `git push origin main` 即可。不要重复 commit。

---

## 七、相关资源

- **GitHub 仓库**:https://github.com/zhangjiwei0221/mahjong
- **部署地址**:https://mahjong-90y.pages.dev
- **Netlify 旧域名**:已冻结,仍可访问旧版本
