# Image2Studio 交付说明

## APK

- 文件：`Image2Studio.apk`
- 大小：1249912 bytes
- SHA256：`0688ac88f70ba10e4323cd24afa2e122548fbb50f44307df073646d071c42f37`
- 包名：`cc.minis.image2studio`
- 版本：versionCode `231` / versionName `2.3.1`

## 权限与风险

- 权限：android.permission.ACCESS_NETWORK_STATE、android.permission.FOREGROUND_SERVICE、android.permission.FOREGROUND_SERVICE_DATA_SYNC、android.permission.INTERNET、android.permission.POST_NOTIFICATIONS、android.permission.WAKE_LOCK
- 风险等级：medium（network access declared）

## 质量检查

通过：11/11

未通过项：
无

## 签名状态

正式签名，使用 Image2Studio 专用 release keystore；密钥不进入仓库。

```text
Verifies
Verified using v1 scheme (JAR signing): true
Verified using v2 scheme (APK Signature Scheme v2): true
Verified using v3 scheme (APK Signature Scheme v3): true
Verified using v3.1 scheme (APK Signature Scheme v3.1): false
Verified using v4 scheme (APK Signature Scheme v4): false
Verified for SourceStamp: false
Number of signers: 1
```

## 附加交付文件

- build_report.json：机器可读质量报告
- RELEASE_CHECKLIST.md：发布前人工检查清单
- PRIVACY_SUMMARY.md：隐私与权限摘要
- SOURCE_MANIFEST.md：源码文件清单
- source.zip：完整源码归档，便于二次开发/备份

## 安装说明

将 APK 发送到 Android 设备，允许“安装未知来源应用”后安装。若系统提示风险，这是 debug/侧载 APK 常见提示，不代表 APK 一定有恶意行为。
