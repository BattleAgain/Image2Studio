# Image2Studio

Image2Studio 是一个 Android 端 image2 AI 生图与图生图工具，支持 OpenAI 兼容图片接口。

## 功能

- 文生图：`/v1/images/generations`
- 图生图 / 图片编辑：`/v1/images/edits`
- Android Photo Picker 导入参考图
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
Model: gpt-image-2
```

API Key 在 App 设置页内填写，可选择是否保存到本机私有配置。

## 安装

从 GitHub Releases 下载最新版 APK 后安装。

## 正式版本

`v1.0.1` 是 Image2Studio 独立公开仓库的第一个正式版本。

APK 使用 Image2Studio 专用正式签名证书签名。请使用同一签名证书构建后续版本，否则 Android 将无法覆盖升级。

## 隐私

- 不内置任何 API Key；
- 不上传用户数据到除用户配置的图片接口以外的服务；
- 历史图片保存在 App 私有目录；
- 可选错误日志默认关闭，启用后只记录错误摘要，并清洗敏感信息。

## 源码结构

```text
app/src/main/java/cc/minis/image2studio/  原生 Android Java 外壳与 Bridge
app/src/main/assets/index.html            WebView UI
app/src/main/res/drawable/ic_launcher.png 应用图标
```
