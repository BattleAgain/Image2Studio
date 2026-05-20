# Image2Studio 交付说明

## APK

- 文件：`Image2Studio.apk`
- 大小：1241744 bytes
- SHA256：`61afa12bd01265e7825b6b79e747ef011ff532de931f7ca2456f2eb6fccf7ea1`
- 包名：`cc.minis.image2studio`
- 版本：versionCode `101` / versionName `1.0.1`

## 权限与风险

- 权限：android.permission.INTERNET
- 风险等级：medium（network access declared）

## 质量检查

通过：11/11

未通过项：
无

## 签名状态

Image2Studio 专用正式签名证书签名。后续版本必须继续使用同一证书以支持覆盖升级。

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

将 APK 发送到 Android 设备，允许“安装未知来源应用”后安装。后续版本需使用同一签名证书构建，才能覆盖升级。
