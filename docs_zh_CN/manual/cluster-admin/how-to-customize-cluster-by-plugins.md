# 如何使用插件定制集群

## <div id="how-to-install-a-webportal-plugin">如何安装Webportal插件</div>

Webportal 插件提供了一种将自定义网页添加到 OpenPAI Webportal 的方法：Webportal插件。Webportal插件可以与其他 PAI 服务进行通信（例如Rest Server），并针对不同需求提供定制解决方案。

作为管理员，您可以在 `services-configuration.yaml` 的 `webportal.plugins` 字段中配置 Webportal 插件（如果您不知道 `services-configuration.yaml` 是什么，请参阅[PAI 服务管理和 Paictl](./basic-management-operations.md#pai-service-management-and-paictl)）：

```yaml
webportal:
  server-port: 9286

  plugins:
  - title: Marketplace
    uri: /scripts/plugins/marketplace.bundle.js
    config:
      repo: Microsoft/pai
```

- `title` 字段是菜单中列出的 Webportal 插件的标题。
- `uri` 字段是 Webportal 插件的入口文件，通常由插件开发人员提供。作为 Webportal 插件的不同部署类型，它可能是绝对 URL 或是相对URL。
- `config` 字段是用于配置 Webportal 插件的 key-value 字典，可用的配置在 Webportal 插件的具体文档中列出。

修改配置后，将其 push 至集群并通过以下方式重启 Webportal：

```bash
./paictl.py service stop -n webportal
./paictl.py config push -p <config-folder> -m service
./paictl.py service start -n webportal
```

## 部署Openpaimarketplace为Webportal插件

[Openpaimarketplace](https://github.com/microsoft/openpaimarketplace) 是一个存储 openpai 示例和任务模板的地方。用户可以使用 openpaimarketplace 共享它们的任务或运行/学习其他人共享的任务。

要部署 openpaimarketplace，请参考 [项目文档](https://github.com/microsoft/openpaimarketplace) 中关于如何部署市场服务和 Webportal 插件的部分。

部署后，按照 [上一部分](#how-to-install-a-webportal-plugin) 更改带有 marketplace 插件 URL 的 Webportal 配置，然后重启 Webportal marketplace了。

   <img src="./imgs/marketplace.png" width="100%" height="100%" /> 
