# 额度时间环：安装与使用

额度时间环帮助你查看本机 Codex 账号的剩余额度、自然重置时间和独立的网友重置预测。它不需要你填写 API Key、密码或令牌，也不会读取开发者的账号。

## 1. 安装前准备

目前只验证过 **macOS 桌面端**。插件需要在本机启动服务，不能直接装进网页版或手机端 ChatGPT 使用；Windows、Linux 暂未验证。

你需要：

- 支持本地插件的 ChatGPT/Codex 桌面应用。
- [Node.js 20 或更新版本](https://nodejs.org/en/download)（建议当前 LTS）和 [Git](https://git-scm.com/downloads)。如果已有，无需重复安装。
- 官方 Codex，并通过它登录你自己的 ChatGPT 账号。参见[官方登录说明](https://learn.chatgpt.com/docs/auth)。仅在浏览器登录 ChatGPT，并不代表本机 Codex 已登录。

打开 macOS 的“终端”，依次检查：

```sh
node --version
git --version
codex --version
codex plugin --help
```

若找不到 `codex` 或不支持 `plugin` 命令，请先按[官方 CLI 说明](https://learn.chatgpt.com/docs/cli)安装或更新 Codex，再重新打开终端。不建议手动修改认证文件。

尚未登录时运行：

```sh
codex login
```

按官方提示选择 ChatGPT 登录。登录在官方流程中完成，不要把凭证粘贴到插件、聊天消息或 GitHub 问题反馈中。账号还需要支持 Codex 额度查询；插件只显示官方服务实际返回的额度。

## 2. 安装插件

在终端依次复制运行以下两行：

```sh
codex plugin marketplace add jusin-lab/quota-time-rings --ref main
codex plugin add quota-rings@quota-rings-personal
```

第一行添加本项目的 GitHub 插件来源，第二行安装额度时间环。安装包已包含运行代码，无需下载源码或执行 `npm install`。

安装后重启桌面应用。在“插件 / Plugins”中查找 **Quota Time Rings**，或点击侧栏的“额度时间环”。也可以新建对话，输入：

> 用额度时间环查看我的额度。

入口位置可能随桌面应用版本变化。项目尚未上架官方公共插件目录，直接在公共目录搜索未必能找到；请先完成上面的安装。

不熟悉终端时，可以把下面这段话和仓库链接发给本机 Codex，让它协助检查和安装：

> 请帮我安装额度时间环：https://github.com/jusin-lab/quota-time-rings 。先检查 Node.js 20+、Git 和 Codex 插件命令是否可用，再从该仓库添加来源并安装 quota-rings@quota-rings-personal。需要账号登录时请让我在官方登录界面自行完成，不要读取或上传认证文件。安装后核对版本，并告诉我如何打开。

## 3. 第一次打开与日常使用

| 你看到的内容 | 含义与操作 |
| --- | --- |
| 加载中 / 读取中 | 正在连接本机服务；首次没有缓存时出现。 |
| 缓存数据 | 先显示上次成功结果，随后刷新；请留意最近读取时间。 |
| 额度剩余 | 官方 Codex 服务报告的可用比例。 |
| 时间剩余 | 当前额度周期距离自然重置还有多久。倒计时结束后，刷新额度确认是否恢复。 |
| 网友预测重置时间 | 公开来源的独立估计，不是官方排期，也不是重置概率。 |

点击“刷新额度”读取最新值。齿轮“选项”可切换语言、自动刷新频率，以及账号实际提供的额度类型和周期；“详情与来源”可查看读取时间、来源链接和预测假设。

“查看演示”只显示虚构示例。真实数据读取失败时，插件不会自动用演示数据代替。

## 4. 更新到最新版本

如果使用上面的 GitHub 安装方式，运行：

```sh
codex plugin marketplace upgrade quota-rings-personal
codex plugin add quota-rings@quota-rings-personal
```

完成后重启桌面应用，并重新打开面板或新建对话。已经打开的旧面板可能仍保留旧代码。面板顶部显示版本号，可与仓库中的 [plugin.json](.codex-plugin/plugin.json) 比对。

如果以前从本地文件夹安装，先重新运行第 2 步的两行命令，即可改用 GitHub 来源。若出现同名来源冲突，先运行 `codex plugin marketplace list` 核对来源，不要删除无关配置。

## 5. 常见问题

| 情况 | 建议 |
| --- | --- |
| 安装时提示 `command not found` | 检查第 1 步对应的软件是否已安装；重新打开终端。 |
| 安装后找不到插件，或仍显示旧版 | 重启桌面应用，新建对话；用下面的版本检查命令确认安装结果。 |
| 未找到 Codex / 无法读取账号额度 | 确认在运行插件的这台电脑上安装并登录官方 Codex；确认账号支持额度查询。 |
| 读取超时或网络失败 | 稍后点击“刷新额度”；有旧值时会保留，不表示它仍是最新值。 |
| 来源扫描时间晚于本机时间 | 本机时钟或外部来源的时间异常；检查系统时间，稍后重试。插件会拒绝异常的新预测，官方额度读取独立进行。 |
| 网友预测没有数据或更新失败 | 公开来源可能暂不可用，或没有可验证的预测。无需重新填写账号凭证。 |
| 只看到部分额度，没有某个 ChatGPT 模型 | 本插件只显示 Codex 返回的额度窗口，不覆盖全部 ChatGPT 模型限额。 |

检查安装结果：

```sh
codex plugin list --marketplace quota-rings-personal --json
```

仍有问题可到 [GitHub Issues](https://github.com/jusin-lab/quota-time-rings/issues)反馈。附上操作系统、桌面应用/CLI 版本、插件版本、出错步骤和错误提示即可；不要上传登录文件、令牌或包含私人账号数据的截图。

## 6. 卸载与数据

不再使用时运行：

```sh
codex plugin remove quota-rings@quota-rings-personal
codex plugin marketplace remove quota-rings-personal
```

第二行只移除本项目的插件来源。插件界面可能在本机浏览器存储中保留最近的展示缓存；卸载不保证清除桌面应用保存的界面存储。详见[隐私说明](PRIVACY.md)。

## 官方参考

- [插件来源命令](https://learn.chatgpt.com/docs/developer-commands#codex-plugin-marketplace)
- [本地插件安装与重启说明](https://developers.openai.com/plugins/build/plugins#install-a-local-plugin-manually)
- [Codex 登录](https://learn.chatgpt.com/docs/auth)

本项目为独立开源插件，使用 MIT 许可证；开源发布不代表 OpenAI 官方审核或背书。
