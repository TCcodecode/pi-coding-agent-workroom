# PI Desk

**给 Pi 一个真正的桌面工作台。**

[Pi coding agent](https://github.com/earendil-works/pi) 的 Electron 桌面客户端：在同一个项目上下文里管理 Agent 会话、观察工具执行、审阅代码变更，并用内建的 HTTP Workbench 把接口验证沉淀成可以重复运行的资产。

> PI Desk 不是另一个 AI，也不重新实现 Pi 的 Agent runtime。它把 Pi 带到桌面上：Pi 负责模型、工具、扩展和会话语义，PI Desk 负责项目工作区、桌面交互、可视化和本地集成。

## 一句话理解

终端里的 Pi 适合启动 Agent；PI Desk 适合长期管理 Agent 工作。

一次完整的工作流是：

```text
打开项目 → 开始或恢复会话 → 观察 Agent 执行 → 审阅变更
    → 搜索代码 / 接入 MCP → 验证 HTTP 接口 → 继续迭代
```

PI Desk 把这条链路放进一个本地桌面工作台，而不是把它拆散在终端、编辑器、API 测试工具和临时脚本之间。

## 两个工作区，一套项目上下文

| 工作区 | 解决的问题 | 主要能力 |
| --- | --- | --- |
| **Agent Workbench** | 和 Pi 一起理解、修改和运行代码 | 多会话、时间线、工具调用、Diff、代码索引、MCP、Todos、模型与用量 |
| **HTTP Workbench** | 把接口探测变成可复跑的验证 | `.http` 测试、环境配置、运行历史、响应资产、HTTP Chat、Agent 协作 |

两个工作区共享项目上下文，但 HTTP 测试资产存放在应用数据目录，不会把验证过程变成项目里的 Git diff。

## 核心体验

### 1. 会话是工作单元

- 项目侧边栏管理多个项目和会话。
- 顶部 Tab 管理当前打开的 working set；关闭 Tab 不会退出应用。
- 支持恢复、重命名、删除、导入、导出、fork 和 clone 会话。
- 会话树让分支和历史跳转变成可点击的操作。
- Agent 在后台运行时可以继续编辑 follow-up；长任务完成后通过系统通知提醒。

### 2. 时间线让 Agent 的工作可读、可审阅

- 流式展示 Markdown 回复、thinking、工具调用和通知。
- 工具调用默认折叠，展开后可以查看输入、输出和执行状态。
- 文件写入前后自动计算 unified diff，直接看到新增和删除行数。
- Resource Inspector 用于查看工具产生的文件、资源和结果。
- Todos、模型、思考级别、token 和 context window 都回到当前会话里。

### 3. 代码上下文不只依赖 grep

PI Desk 在本地运行基于 tree-sitter / WebAssembly 的符号索引：

- 后台增量索引项目代码。
- `search_symbols`：按名称查找函数、类和其他符号。
- `find_usages`：查找符号的引用和使用位置。
- 索引工具作为 Pi extension 暴露给 Agent，Agent 可以直接使用结构化结果。
- 不需要额外的云端索引服务，索引数据库位于项目的 `.code-index/` 目录。

### 4. MCP 是项目能力的一部分

- 合并读取用户级和项目级 MCP 配置。
- 支持导入 Cursor 的 MCP 配置。
- 在桌面端查看服务器状态，并启用或禁用项目级服务器。
- MCP 工具、资源和提示仍由 Pi runtime 执行；PI Desk 负责配置、状态和交互。

### 5. HTTP 验证和 Agent 协作放在一起

HTTP Workbench 不是一个孤立的请求发送器，而是一套可以留在项目里的验证工作流：

- 在 `.http` 文件中编写请求，并在编辑器内查看运行结果。
- 为每个项目维护 `local`、`dev`、`staging`、`production` 等环境。
- 保存文件级和目录级运行历史，包括状态、耗时、脱敏响应和失败信息。
- 通过内建 `http-workbench` extension，让 Agent 创建、读取和运行项目下的 HTTP 测试。
- 一次性探测可以使用 curl；需要重复验证时，沉淀为可复跑的 `.http` 资产。

## 安全和边界

PI Desk 的桌面层尽量保持小而明确的权限边界：

- Renderer 不直接访问文件系统、Shell、凭据或 Node.js 能力。
- 所有特权操作都经过 Electron main process，并通过 preload 暴露的窄接口完成。
- `contextIsolation` 和 Electron `sandbox` 保持开启。
- 项目资源加载前提供项目信任确认；信任确认只控制资源加载，不等同于安全沙箱。
- HTTP Workbench 的环境、运行历史和响应资产存放在应用数据空间，不污染项目目录。
- 外部链接只允许通过受限的 `http(s)` 地址打开。

## 架构

```text
┌──────────────────────────────────────────────────────────────┐
│                     PI Desk · Electron                       │
│                                                              │
│  React Renderer                                               │
│  Timeline · Composer · Sessions · HTTP Workbench · Settings   │
│                 │                                             │
│                 │ window.pi / typed IPC                       │
│                 ▼                                             │
│  Preload · contextBridge · contextIsolation · sandbox         │
│                 │                                             │
│                 ▼                                             │
│  Electron Main · desktop authority                            │
│  Pi host · sessions · projects · MCP · code index · HTTP       │
│  provider auth · notifications · file changes                  │
│                 │                                             │
│                 ▼                                             │
│  @earendil-works/pi-coding-agent                              │
│  Agent loop · providers · tools · extensions · session format   │
└──────────────────────────────────────────────────────────────┘
```

边界原则：

1. **Pi owns agent semantics**：模型、Provider、工具循环、扩展、压缩和会话语义由 Pi 负责。
2. **Main owns desktop authority**：文件、进程、会话生命周期、MCP 配置、HTTP 资产和系统通知由主进程负责。
3. **Renderer owns presentation**：渲染层只消费状态、收集用户意图，不直接操作本地资源。

## 数据放在哪里

| 数据 | 位置 | 归属 |
| --- | --- | --- |
| Pi 会话 | `~/.pi/agent/sessions/` | Pi coding agent |
| 项目注册表 | Electron `userData/projects.json` | PI Desk |
| HTTP Workbench | `<userData>/http-workbench/<project-uid>/` | PI Desk |
| 代码索引 | `<project>/.code-index/index.db` | PI Desk / code-index extension |
| MCP 配置 | 用户级 `mcp.json` + 项目 `.mcp.json` / `.pi/mcp.json` | Pi MCP adapter 与 PI Desk |

PI Desk 不复制一份新的会话数据库来替代 Pi。关闭应用后，Pi 的会话文件仍然是可恢复的事实来源。

## 下载与安装

正式安装包发布在 [GitHub Releases](https://github.com/TCcodecode/pi-desk/releases)：

- macOS：下载对应架构的 `.dmg`，拖动 `Pi Desk.app` 到 Applications。
- Windows：运行 `.exe` 安装包；不想安装时可使用 `.zip` 便携版。
- Linux：优先使用 `.AppImage`，Debian/Ubuntu 可使用 `.deb`。

当前 macOS 版本暂时没有 Apple Developer ID 签名。首次打开时请在 Finder 中对
`Pi Desk.app` 使用“右键 → 打开”，或到“系统设置 → 隐私与安全性 → 仍要打开”
确认一次。若仍显示 app“已损坏”，先确认下载文件的 SHA256 与 Release 中的
`SHA256SUMS` 一致，再执行：

```bash
xattr -dr com.apple.quarantine "/Applications/Pi Desk.app"
```

这只移除该应用的下载隔离标记；不要为了安装 Pi Desk 全局关闭 Gatekeeper。
获得 Developer ID 证书并完成公证后，macOS 会恢复普通双击启动流程。

## 从源码运行

当前项目以源码运行和本地开发为主：

```bash
npm install
npm run dev
```

常用命令：

```bash
npm run build       # 构建 main / preload / renderer
npm run dist        # 构建当前平台安装包（不发布）
npm run dist:mac    # macOS DMG + ZIP
npm run dist:win    # Windows NSIS + ZIP
npm run dist:linux  # Linux AppImage + deb + tar.gz
npm run preview     # 预览构建产物
npm test            # 运行 Vitest 测试
npm run typecheck   # TypeScript 类型检查
```

## 项目结构

```text
electron/
  main.ts                 Electron 主进程、窗口和 IPC 注册
  piHost.ts               Pi runtime 桥接、会话生命周期和事件转发
  preload.ts              暴露给 renderer 的 PiApi
  httpWorkbench.ts        HTTP 资产、环境、运行历史和执行器
  indexService.ts         本地代码索引服务
  sessionCatalog.ts       会话扫描和目录
  projectCatalog.ts       项目注册表
  providerUsage/          Provider 用量适配器
  sessionNotifications.ts 会话完成通知

src/
  shared/protocol.ts       main / preload / renderer 共享协议和类型
  renderer/                React 应用和桌面工作区 UI

packages/
  code-index/              符号索引与引用搜索
  code-index-pi-extension/ 将代码索引暴露给 Pi Agent
  mcp-bridge/              MCP 配置合并、导入和服务器控制
  session-todo/             todowrite / todoread 与会话状态
```

## 技术栈

| 层 | 技术 |
| --- | --- |
| Desktop shell | Electron 43 |
| Agent runtime | [`@earendil-works/pi-coding-agent`](https://github.com/earendil-works/pi/tree/main/packages/coding-agent) |
| Renderer | React 19 + Vite + Zustand |
| UI primitives | Radix UI + lucide-react |
| Markdown | react-markdown + remark-gfm |
| Code intelligence | web-tree-sitter + 本地索引 |
| Validation | Vitest + Testing Library |

## PI Desk 和 Pi 的关系

如果你已经在终端使用 Pi，PI Desk 的目标是让这套工作继续存在于桌面上：

- 继续使用 Pi 支持的模型和 Provider。
- 继续使用 Pi 的 session、skills、extensions 和 MCP 生态。
- 继续由 Pi 执行 Agent 的工具和任务。
- 用桌面时间线、会话树、Diff、代码索引和 HTTP Workbench 管理上下文。

它不是一个新的模型入口，也不是一个需要把项目迁移到云端的服务。

## 常见问题

### PI Desk 会替换 Pi CLI 吗？

不会。PI Desk 是桌面客户端，Pi 仍然是 Agent engine。两者共享 Pi 的会话和配置体系。

### PI Desk 是安全沙箱吗？

不是。项目信任确认、IPC 边界和 Electron 的隔离配置可以减少误操作和权限暴露，但不能替代操作系统级或容器级沙箱。如果需要更强隔离，应在容器、虚拟机或其他受控环境中运行 Agent。

### 为什么 HTTP Workbench 不放在项目目录里？

因为接口运行历史、环境配置和响应资产通常是本地工作状态，不应该自动变成项目 Git diff。PI Desk 将它们放入应用数据目录，同时保留按项目组织的结构。

## 上游项目

- [Pi Agent Harness](https://github.com/earendil-works/pi)
- [`@earendil-works/pi-coding-agent`](https://www.npmjs.com/package/@earendil-works/pi-coding-agent)

PI Desk is built for the Pi coding agent and is currently under active development.
