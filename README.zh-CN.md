# Pi Workroom

> [Pi coding agent](https://github.com/earendil-works/pi) 的桌面工作区。

在一个本地 Electron 工作区中运行和恢复 Pi 会话、审阅 Agent 改动、管理 MCP 工具、搜索代码，并验证 API。

[English README](README.md) · [下载 Release](https://github.com/TCcodecode/pi-coding-agent-workroom/releases) · [提交问题或建议](https://github.com/TCcodecode/pi-coding-agent-workroom/issues) · [了解 Pi](https://github.com/earendil-works/pi)

<!-- 截图占位：在这里加入 docs/images/hero.png。拍摄要求见 docs/readme-assets.md。 -->

## 为什么需要 Pi Workroom？

Pi 在终端里已经很好用；但当编码任务变长、项目和会话变多时，你还需要一个能持续看清工作状态的地方：计划、工具调用、文件改动、接口验证，以及下一步 follow-up。

Pi Workroom 是 Pi 外围的桌面层，不会替代 Pi，也不会重新实现一个 Agent runtime。Pi 仍然是模型、Provider、工具循环、扩展和会话语义的事实来源。

## 你能用它做什么？

| 区域 | 你会得到什么 |
| --- | --- |
| **Agent 工作区** | 多项目、多会话、多 Tab、会话树、计划、待办与 follow-up |
| **实时审阅** | 流式回复和工具调用时间线，以及统一格式的文件 Diff |
| **MCP 与代码搜索** | 项目级 MCP 配置、Cursor MCP 导入、本地符号搜索和引用查找 |
| **HTTP Workbench** | 可复跑 `.http` 测试、环境、运行历史、耗时、错误和脱敏响应 |

<!-- 截图占位：在此处加入 2×2 功能图。拍摄要求见 docs/readme-assets.md。 -->

## 安装

### 下载 Release

从 [GitHub Releases](https://github.com/TCcodecode/pi-coding-agent-workroom/releases) 下载对应平台的安装包。

| 平台 | 提供的安装包 |
| --- | --- |
| macOS | `.dmg` 与 `.zip` |
| Windows | NSIS 安装包与 `.zip` |
| Linux | `.AppImage`、`.deb` 与 `.tar.gz` |

当前预览版的标题已更新为 Pi Workroom，但安装包文件名仍带旧名称 **PiDesk**，因为它在改名前构建。它就是同一个项目；后续安装包会使用 Pi Workroom。macOS 安装包暂未完成 Developer ID 签名和公证，首次启动时可能需要在 Finder 中右键选择“打开”。

### 从源码运行

需要 Node.js 22.12.0 或更高版本。

```bash
git clone https://github.com/TCcodecode/pi-coding-agent-workroom.git
cd pi-coding-agent-workroom
npm install
npm run dev
```

如果安装后缺少 Electron，请运行：

```bash
npm install --include=dev
npm rebuild electron
npm run dev
```

## 前五分钟

1. 打开一个本地项目目录。
2. 新建 Pi 会话，或恢复你此前在终端中使用的会话。
3. 如果尚未完成 Pi 配置，在设置中登录或配置模型 Provider。
4. 发送任务，在时间线中审阅工具调用、计划和文件改动。
5. 将反复使用的 API 检查沉淀成 HTTP Workbench 里的 `.http` 测试。

Pi Workroom 会继续使用 Pi 已有的会话、Provider 配置、skills、extensions 和 MCP 生态。

## Pi 与 Pi Workroom 的边界

| Pi 负责 | Pi Workroom 负责 |
| --- | --- |
| 模型、Provider、工具循环、扩展、会话语义 | 桌面窗口、项目工作区、可视化审阅和本地集成 |
| Pi 的会话文件与配置 | 项目注册表、HTTP Workbench 资产、代码索引展示 |

Renderer 通过类型化 IPC 与 Electron main process 通信，不会获得不受限制的文件系统、Shell 或 Node.js 权限。

## 本地数据与安全边界

- Pi 会话继续由 Pi 的会话系统保存。
- 项目注册与 HTTP Workbench 状态保存在应用的本地数据目录。
- 代码索引保存在 `<project>/.code-index/`，不依赖云端索引服务。
- Electron 的 `contextIsolation` 与 sandbox 会缩小 Renderer 权限，但 Pi Workroom 不是操作系统级安全沙箱。若任务需要强隔离，请使用容器、虚拟机或其他受控环境。

## 开发

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

项目按四个产品领域组织：`app`、`session`、`workspace` 和 `http`。Pi runtime 语义保留在 main process 的 Pi host 中；Renderer 仅通过 `window.pi` 呈现投影后的状态。

## 参与和支持

请通过 [Issues](https://github.com/TCcodecode/pi-coding-agent-workroom/issues) 提交 Bug 和聚焦的功能建议。请附上平台、Pi Workroom 版本、复现步骤和相关日志；分享前务必移除 API key、Cookie、令牌和私有路径。

## 后续补充的视觉资产

README 的文字结构已经就位。需要拍摄的截图和演示视频清单见 [docs/readme-assets.md](docs/readme-assets.md)。

## 许可与致谢

本项目当前尚未声明许可证。在维护者发布许可证前，请不要假定可以再分发或复用代码。

Pi Workroom 建立在下列项目之上：

- [Pi Agent Harness](https://github.com/earendil-works/pi)
- [`@earendil-works/pi-coding-agent`](https://www.npmjs.com/package/@earendil-works/pi-coding-agent)
