# Image2Studio 发布前检查清单

## 自动检查结论

- 权限风险：medium（network access declared）
- 自动质量检查：11/11
- 未通过项：无

## 上架/商用前必须人工确认

- [ ] 确认正式签名证书已安全备份，后续版本继续使用同一证书
- [ ] 确认 app 名称、图标、包名、版本号符合发布计划
- [ ] 准备隐私政策 URL；即使无联网，也建议说明本地数据存储方式
- [ ] 如声明 INTERNET，说明联网目的、接口域名、数据用途
- [ ] 如后续加入账号、定位、相机、联系人、文件等权限，必须加入运行时授权和隐私说明
- [ ] 确认不硬编码 API key、token、密码或用户隐私数据
- [ ] 在目标 Android 版本上真机安装、启动、核心流程测试
- [ ] 准备应用截图、简介、更新日志、客服/开发者联系方式
- [ ] 确认第三方 SDK/开源库许可证与合规声明
- [ ] 正式发布前执行一次干净构建并保存 build_report.json

## 当前 Manifest 摘要

- 包名：`cc.minis.image2studio`
- 版本：`14 / 2.2.4`
- targetSdk：`35`
- allowBackup：`false`
- cleartext：`false`
- 权限：android.permission.INTERNET
