# Image2Studio

Image2Studio 是一个 Android 端 image2 AI 生图与图生图工具，支持 OpenAI 兼容图片接口，并包含可自部署的 Cloudflare 云任务后端。

## 这一版开始的仓库原则

从 `v2.3.1` 开始，GitHub 仓库保持完整交付：

- Android APK 客户端源码；
- Cloudflare Worker 云任务服务端源码；
- D1 schema / migrations；
- Worker 部署文档与 `wrangler.toml.example`；
- Release 附件里的正式签名 APK 与源码包。

真实密钥、签名证书、Cloudflare resource id、后台 token、用户 API Key 不进仓库。

## 功能

- 文生图：`/v1/images/generations`
- 图生图 / 图片编辑：`/v1/images/edits`
- 云任务模式：App 提交任务，Worker + Queue 后台生成，App 轮询恢复
- Android Photo Picker 导入参考图
- 图生图参考图上传前压缩，避免大图/部分 file uri 导致失败
- 生成结果本地历史
- 分享、编辑、保存、单条删除历史
- 图生图独立结果区
- 图片大图预览
- 启动自动获取模型并优先选择 `gpt-image-2`
- 可选错误日志：默认关闭，只记录错误，不记录成功、提示词、API Key 等敏感信息
- 生成耗时显示

## 默认接口

```text
Base URL: https://factory.pub
Cloud URL: https://i2.tmlgbd.cc.cd
Model: gpt-image-2
```

API Key 在 App 设置页内填写，可选择是否保存到本机私有配置。云任务模式下 API Key 只用于本次任务，服务端用 AES-GCM 加密暂存在 Queue 消息里，不写 D1/KV/日志。

## 源码结构

```text
app/src/main/java/cc/minis/image2studio/  Android Java 外壳、WebView Bridge、前台服务
app/src/main/assets/index.html            WebView UI
app/src/main/res/                         Android 资源
cloudflare-worker/                        Cloudflare Worker 云任务后端
cloudflare-worker/src/worker.js           Worker API / Queue consumer
cloudflare-worker/schema.sql              D1 初始化脚本
cloudflare-worker/migrations/             D1 迁移脚本
```

## 安装

从 GitHub Releases 下载最新版 APK 后安装。

APK 使用 Image2Studio 专用正式签名证书签名。后续版本必须使用同一签名证书，否则 Android 无法覆盖升级。

## 云端部署

看 [`cloudflare-worker/README.md`](cloudflare-worker/README.md)。

## 隐私

- 不内置任何 API Key；
- 用户可选择本机保存或不保存 API Key；
- 云任务服务端不把用户 API Key 写入 D1/KV/日志；
- 历史图片保存在 App 私有目录；
- 可选错误日志默认关闭，启用后只记录错误摘要，并清洗敏感信息。
