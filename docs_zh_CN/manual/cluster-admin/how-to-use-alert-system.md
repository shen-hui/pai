# 如何使用报警系统

OpenPAI自带一个报警系统。该系统有一些预先定义好的报警规则（alert rules）和相应的处理措施（alert actions）。管理员也可以自定义这些规则和措施。在此文档中，我们将详细介绍该报警系统。

## 报警规则

OpenPAI使用普罗米修斯（[Prometheus](https://prometheus.io/)）来监控整个环境，并获得监控指标（metrics）。这些指标包括内存使用率、磁盘使用率、GPU使用率等等。我们可以利用这些指标设定一些报警规则。报警规则同样是在普罗米修斯中配置，这些规则定义了一些条件，当特定条件满足时，普罗米修斯就会发送相应的报警。

例如，下面的配置展示了一个预先定义好的报警 `GpuUsedByExternalProcess`。它使用了指标`gpu_used_by_external_process_count`。如果一个外部进程使用了PAI系统中的GPU资源，且持续时间超过5分钟，普罗米修斯就会触发`GpuUsedByExternalProcess`报警。

``` yaml
alert: GpuUsedByExternalProcess
expr: gpu_used_by_external_process_count > 0
for: 5m
annotations:
  summary: found nvidia used by external process in {{$labels.instance}}
```

关于报警规则的详细语法，请参考[这里](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/)。

不管是由预先定义的规则触发报警的还是自定义规则触发的报警，都会在Webportal上展示出来（在页面右上角）。

### 预定义的报警规则

OpenPAI提供了很多预先定义好的指标和报警规则。您可以访问`http(s)://<your master IP>/prometheus/graph`来查看指标。一些比较常用的指标有：

  - `task_gpu_percent`: OpenPAI任务单个task的GPU使用率。
  - `task_cpu_percent`: OpenPAI任务单个task的CPU使用率。
  - `node_memory_MemTotal_bytes`: 某个机器上的所有内存（以byte为单位）。
  - `node_memory_MemAvailable_bytes`: 某个机器上的可用内存（以byte为单位）。

您可以访问`http(s)://<your master IP>/prometheus/alerts`来查看基于这些规则预先定义的报警规则。

### 如何添加报警规则

您可以在[`services-configuration.yaml`](./basic-management-operations.md#pai-service-management-and-paictl)的`prometheus`部分添加自定义的报警规则。例如，您可以添加一个`PAIJobGpuPercentLowerThan0_3For1h`的报警：

``` yaml
prometheus:
  customized-alerts: |
    groups:
    - name: customized-alerts
      rules:
        - alert: PAIJobGpuPercentLowerThan0_3For1h
          expr: avg(task_gpu_percent{virtual_cluster=~"default"}) by (job_name) < 0.3
          for: 1h
          labels:
            severity: warn
          annotations:
            summary: "{{$labels.job_name}} has a job gpu percent lower than 30% for 1 hour"
            description: Monitor job level gpu utilization in certain virtual clusters.
```

当在`default`虚拟集群上的任务有一个GPU利用率低于`30%`的task，且持续时间超过`1小时`时，将会触发`PAIJobGpuPercentLowerThan0_3For1h`报警。这里我们在报警规则中使用了`task_gpu_percent`指标，这个指标描述了OpenPAI任务单个task的GPU使用率。 您可以用`labels.severity`域来定义报警的严重程度，可选的严重程度有`info`、`warn`、`error`或`fatal`。这里我们使用`warn`。

为了使设置生效，您需要将修改后的设置上传到集群中，并重启`prometheus`服务。请在[dev box容器](./basic-management-operations.md#pai-service-management-and-paictl)中遵循以下步骤：

```bash
./paictl.py service stop -n prometheus
./paictl.py config push -p /cluster-configuration -m service
./paictl.py service start -n prometheus
```

关于报警规则的语法，请参考[这里](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/)。

## 处理措施和路由

为了处理报警，管理员可以选择使用不同的处理措施（alert actions）。我们提供一些预先定义好的处理措施，当然，您也可以添加您自己的处理措施。在这部分文档中，我们会先介绍预定义的处理措施以及报警和处理措施间的匹配规则。然后，我们会介绍如何添加新的处理措施。处理措施和匹配规则都是由[`alert-manager`](https://prometheus.io/docs/alerting/latest/alertmanager/)来提供的。

### 预定义的处理措施和匹配规则

在OpenPAI中，处理措施和匹配规则被实现在`alert-manager`服务中。您需要修改[`services-configuration.yaml`](./basic-management-operations.md#pai-service-management-and-paictl)的`alert-manager`部分来使用它们。`alert-manager`部分的完整定义如下：

```yaml
alert-manager:
  port: 9093
  alert-handler:
    port: 9095
    pai-bearer-token: 'your-application-token-for-pai-rest-server'
    email-configs:
      admin-receiver: addr-of-admin-receiver@example.com
      smtp-host: smtp.office365.com
      smtp-port: 587
      smtp-from: alert-sender@example.com
      smtp-auth-username: alert-sender@example.com
      smtp-auth-password: password-for-alert-sender
  customized-routes:
    routes:
    - receiver: pai-email-admin-user-and-stop-job
      match:
        alertname: PAIJobGpuPercentLowerThan0_3For1h
  customized-receivers:
  - name: "pai-email-admin-user-and-stop-job"
    actions: 
      email-admin:
      email-user:  
        template: 'kill-low-efficiency-job-alert'
      stop-jobs:
      tag-jobs:
        tags: 
        - 'stopped-by-alert-manager'

```

目前，我们提供以下预定义的处理措施：

  - `email-admin`: 给特定的管理员发邮件。
  - `email-user`: 给任务的提交者发邮件。目前，`email-user`和`email-admin`使用的是同样的邮件模板。
  - `stop-jobs`: 调用OpenPAI REST API来结束任务。**请注意，目前这个处理措施在结束任务后，并不会通知相应的用户。**
  - `tag-jobs`: 调用OpenPAI REST API来给任务添加tag。
  - `cordon-nodes`: 调用Kubernetes API来cordon对应的结点.

在您使用这些处理措施前，您需要在`alert-handler`部分进行一些设置。例如, 处理措施`email-admin`需要您设置一个SMTP账号来发邮件，并且需要一个管理员邮箱来接收邮件。而`tag-jobs`和`stop-jobs`调用了OpenPAI REST API，需要您指定一个token。token的获取方法是：登录Webportal，转到个人资料页（在Webportal右上角，点击`View my profile`），使用 `Create application token`来生成。总的来说，`alert-handler`字段有两部分设置：一部分是`email-configs`，另一部分是`pai-bearer-token`。不同处理措施会依赖不同部分的设置，具体的依赖关系请参考下表：

|              | email-configs | pai-bearer-token |
| :-----------:| :-----------: | :--------------: |
| cordon-nodes | -             | -                |
| email-admin  | 需要          | -                 |
| email-user   | 需要          | 需要              |
| stop-jobs    | -             | 需要             |
| tag-jobs     | -             | 需要             |

另外，一些处理措施还依赖在报警实例（alert instance）的`labels`中包含特定的字段。这些`labels`是根据报警规则中的expression来生成的。例如，上述`PAIJobGpuPercentLowerThan0_3For1h·`报警的expression是`avg(task_gpu_percent{virtual_cluster=~"default"}) by (job_name) < 0.3`。这个expression会返回一个列表，列表中每个元素都有一个`job_name`字段。 `stop-jobs`这个处理措施就依赖`job_name`字段，它会根据`job_name`字段去结束对应的任务。当报警信息处于触发状态（firing）时，您可以访问`http(s)://<your master IP>/prometheus/alerts`页面，在这个页面上可以看到对应报警有哪些`labels`。各个预定义处理措施和字段的依赖关系请参考下表：

|              | 在`labels`中依赖的字段 |
| :-----------:| :------------------: |
| cordon-nodes | node_name            |
| email-admin  | -                    | 
| email-user   | -                    |
| stop-jobs    | job_name             |
| tag-jobs     | job_name             |


报警和处理措施之间的匹配关系是由`receivers`和`routes`定义的。一个`receiver`就是一组处理措施。而`route`会把报警匹配给对应的`receiver`。

默认情形下，所有报警都只会触发`email-admin`（不过，如果您没有配置email信息的话，这个处理措施并不会实际生效）。您可以在[`service-configuration.yaml`](./basic-management-operations.md#pai-service-management-and-paictl)中的`alert-manager`部分配置`receiver`和`route`，下面是一个示例：

``` yaml
alert-manager:
  ......
  customized-routes:
    routes:
    - receiver: pai-email-admin-user-and-stop-job
      match:
        alertname: PAIJobGpuPercentLowerThan0_3For1h
  customized-receivers:
  - name: "pai-email-admin-user-and-stop-job"
    actions: 
      email-admin:
      email-user:  
        template: 'kill-low-efficiency-job-alert'
      stop-jobs:
      tag-jobs:
        tags: 
        - 'stopped-by-alert-manager'
  ......
```

这里我们实际定义了：

- 一个名为pai-email-admin-user-and-stop-job的`receiver`。这个`receiver`包含了四个处理措施：`email-admin`, `email-user`, `stop-jobs`和`tag-jobs`。
- 一个`route`。它将报警pai-email-admin-user-and-stop-job匹配给上面的`receiver`pai-email-admin-user-and-stop-job。

当设置完成后，当报警`PAIJobGpuPercentLowerThan0_3For1h`被触发时，所有4个处理措施都会被执行。

关于`routes`，我们采用了[Prometheus Alertmanager](https://prometheus.io/docs/alerting/latest/configuration/)的语法规则。

而关于`receivers`的定义，您可以遵循下面的步骤：

- 在 `name` 字段给它起一个名字
- 在`actions`字段列出所有您希望使用的处理措施，并且给这些处理措施添加需要的参数。处理措施和相应的参数请参考下面的列表：
  - `email-admin`：
    - `template`：可选参数。可以是'general-template'或'kill-low-efficiency-job-alert'。默认是'general-template'。
  -  `email-user`：
    - `template`：可选参数。可以是'general-template'或'kill-low-efficiency-job-alert'。默认是'general-template'。
  - `cordon-nodes`：没有需要填写的参数。
  - `stop-jobs`：没有需要填写的参数。
  - `tag-jobs`：
    - `tags`：必须要填写的参数，表示添加tag的列表。

您还可以在 `pai/src/alert-manager/deploy/alert-templates`目录中添加自定义的邮件模板。一个模板须包含两个文件：`html.ejs`，为邮件正文模板；`subject.ejs`，为邮件主题模板。模板所在的文件夹的名字就是这个模板的名字。

为了使设置生效，您需要将修改后的设置上传到集群中，并重启`alert-manager`服务。请在[dev box容器](./basic-management-operations.md#pai-service-management-and-paictl)中遵循以下步骤：

```bash
./paictl.py service stop -n alert-manager
./paictl.py config push -p /cluster-configuration -m service
./paictl.py service start -n alert-manager
```
关于OpenPAI的服务管理，请参考[这个文档](./basic-management-operations.md#pai-service-management-and-paictl)。

### 如何添加自定义的处理措施

如果您想要添加自定义的处理措施，请参考下面的步骤：

####  在'alert-handler'中实现相应的措施

`alert-handler`是一个轻量的`express`应用，您可以在其中方便地添加一些自定义的API。

例如，`stop-jobs`这个处理措施实际是通过普罗米修斯的`webhook`调用`localhost:9095/alert-handler/stop-jobs`来实现的。在`alert-handler`内部，这个请求被转发给OpenPAI的REST API，来结束相应的任务。您可以再`alert-handler`中添加新的API，来实现新的处理措施。

`alert-handler`的源码位置在[这里](https://github.com/microsoft/pai/blob/master/src/alert-manager/src/alert-handler)。

#### 检查处理措施的依赖

正如我们之前所说的，想要让一个处理措施可用，管理员需要添加相应的配置。

请检查[这个文件夹](https://github.com/microsoft/pai/tree/master/src/alert-manager/config)， 并且为您新添加的处理措施指定它的依赖规则。

#### 在Webhook的定义中添加该处理措施

在`service-configuration.yaml`中定义`receiver`的时候，实际我们会把对应的处理措施渲染到[这里](https://github.com/microsoft/pai/blob/master/src/alert-manager/deploy/alert-manager-configmap.yaml.template)的webhook_configs中。

所有我们提供的处理措施，即`email-admin`, `email-user`, `stop-jobs`, `tag-jobs`和`cordon-nodes`，在`alert-manager`中会发送相应的POST请求到`alert-handler`，对应的URL如下：

- `localhost:{your_alert_handler_port}/alert-handler/send-email-to-admin`
- `localhost:{your_alert_handler_port}/alert-handler/send-email-to-user`
- `localhost:{your_alert_handler_port}/alert-handler/stop-jobs`
- `localhost:{your_alert_handler_port}/alert-handler/tag-jobs/:tag`
- `localhost:{your_alert_handler_port}/alert-handler/cordon-nodes`

发送POST请求时，请求的body是由`alert-manager`自动填写的。具体的处理措施将会在`alert-handler`内部运行。

请在[这里](https://github.com/microsoft/pai/blob/master/src/alert-manager/src/alert-handler)添加您处理措施名称到`alert-handler` URL路径的渲染规则。

以上步骤全部完成后，记得在dev box容器中重新build和push Docker镜像，并在重启`alert-manager`服务。

```bash
./build/pai_build.py build -c /cluster-configuration/ -s alert-manager
./build/pai_build.py push -c /cluster-configuration/ -i alert-handler
./paictl.py service stop -n alert-manager
./paictl.py config push -p /cluster-configuration -m service
./paictl.py service start -n alert-manager
```
