# Image2Studio SPEC

## 目标

生成一个成品级 Android APK：Image2Studio，用于调用 OpenAI 兼容图片接口 / image2 中转站进行文生图、图生图/图片编辑。

## 技术约束

- 原生 Android Java 单 Activity，适配现有 apkgen 构建器。
- 不使用 Gradle，不引入外部三方库。
- 不硬编码用户 API Key。
- 需要 INTERNET 权限。
- targetSdk 35，allowBackup=false，usesCleartextTraffic=false。

## 默认接口

- 默认 Base URL：`https://factory.pub`
- 默认模型：`gpt-image-2`
- 获取模型：`GET {baseUrl}/v1/models`
- 文生图：`POST {baseUrl}/v1/images/generations` JSON
- 图生图：`POST {baseUrl}/v1/images/edits` multipart/form-data，多个图片字段都叫 `image`
- 认证：`Authorization: Bearer <API_KEY>`

## 必备功能

1. 设置区
   - Base URL 输入框，默认 `https://factory.pub`
   - API Key 输入框，默认不显示明文，支持保存/清除
   - 模型输入框，默认 `gpt-image-2`
   - 获取模型按钮，请求 `/v1/models` 后显示列表/日志，允许点击或复制模型名

2. 文生图
   - 正向提示词输入
   - 反向提示词输入，可选
   - 生成数量 1-4
   - 比例预设：auto、1:1、4:3、3:2、16:9、21:9、9:16、2:3、3:4、4:5
   - 生成按钮，请求 `/v1/images/generations`

3. 图生图/编辑
   - 选择 1-4 张图片
   - 显示已选图片数量和名称
   - 编辑提示词输入
   - 生成数量 1-4
   - 比例预设同文生图
   - 请求 `/v1/images/edits` multipart

4. 结果区
   - 兼容响应 `data[].url`、`data[].b64_json`、`data[].b64`
   - 显示生成图片
   - 支持保存到公共 Pictures/Image2Studio 目录
   - 支持分享图片
   - 支持打开 URL 结果

5. 历史与日志
   - 最近 20 条历史保存在 SharedPreferences，记录模式、提示词、时间、缩略信息、图片 data URL/URL
   - 可清空历史
   - 请求日志必须隐藏 API Key，只显示 `Bearer ***`
   - 错误显示优先 `error.message`，否则原始响应文本

## UI 要求

- 成品感，不是简单 demo。
- 深色科技风，顶部标题、状态卡片、分区卡片、按钮清晰。
- 单 Activity 内滚动布局即可。
- 所有网络请求后台线程，UI 不阻塞。

## 交付要求

- 实际构建 APK。
- apksigner verify 通过。
- 输出 APK、build_report、DELIVERY、RELEASE_CHECKLIST、PRIVACY_SUMMARY、SOURCE_MANIFEST、source.zip 到 attachments。
- 源码保留在 `/var/minis/workspace/apkgen/Image2Studio`。
