# 安装指南

OpenPAI的架构在`v1.0.0`时进行了更新和优化。在`v1.0.0`之前，OpenPAI基于Yarn和Kubernetes，数据由HDFS管理。从`v1.0.0`开始，OpenPAI转变为纯Kubernetes的架构。除此之外，`v1.0.0`还包括许多新特性，如`AAD 认证`、`Hived调度器`、`Kube Runtime`、`Marketplace`等。如果您仍要安装旧的基于Yarn的OpenPAI，请使用`v0.14.0`。

要安装 OpenPAI >= `v1.0.0`, 请先检查[安装要求](#installation-requirements)。 接下来, 如果您之前没有安装过OpenPAI，请阅读并跟随[从头开始安装](#installation-from-scratch)中的操作步骤。如果您之前安装过OpenPAI，请先[清除已有安装](#clean-previous-deployment), 再[从头开始安装](#installation-from-scratch)。

## <div id="installation-requirements">安装要求</div>

OpenPAI的部署要求您至少有3台独立的机器：一台dev box机器、一台master机器和一台worker机器。

dev box机器在安装、维护和卸载期间，通过SSH控制master机器和worker机器。您应该指定唯一一台dev box机器。master机器用于运行核心Kubernetes组件和核心OpenPAI服务。目前，您只能指定唯一一台master机器。我们建议您使用纯CPU机器作为dev box机器和master机器。另外，所有的worker机器都应该有GPU，并正确安装GPU驱动程序。

详细来说，请在安装前检查以下要求：

- dev box机器
    - 硬件要求
        - 它可以与所有其他机器（master和worker机器）通信。
        - 它是除了master机器和worker机器外的一台独立计算机。
    - 软件要求
        - Ubuntu 16.04 (18.04应该可用，但没有经过完整测试)
        - SSH服务已开启。
        - 可以免密登录所有master和worker机器。
        - Docker已被正确安装。您可以用命令`docker --version`来检查。如果您的Docker未被正确安装，可以参考[Docker的安装指南](https://docs.docker.com/engine/install/ubuntu/)。
- master机器
    - 硬件要求
        - 至少40GB内存。
        - 必须有**固定的IP地址**，且可以和其他所有机器通信。
        - 可以访问Internet。尤其是可以访问Docker Hub。部署过程会从Docker Hub拉取Docker镜像。
    - 软件要求
        - Ubuntu 16.04 (18.04应该可用，但没有经过完整测试)
        - SSH服务已开启，和所有Worker机器有同样的SSH用户名和密码，且该SSH用户有sudo权限。
        - NTP已被成功开启。 您可以用命令`apt install ntp`来检查。
    - 其他要求
        - 它是OpenPAI的专用服务器。OpenPAI管理它的所有CPU、内存和GPU资源。如果有其他工作负载，则可能由于资源不足而导致未知问题。
- worker机器:
    - 硬件要求
        - 至少16GB内存
        - 必须有至少一块GPU。
        - 必须有**固定的IP地址**，且可以和其他所有机器通信。
        - 可以访问Internet。尤其是可以访问Docker Hub。部署过程会从Docker Hub拉取Docker镜像。
    - 软件要求
        - Ubuntu 16.04 (18.04应该可用，但没有经过完整测试)
        - SSH服务已开启，所有master和worker机器有同样的SSH用户名和密码，且该SSH用户有sudo权限。
        - Docker已被正确安装。您可以用命令`docker --version`来检查。如果您的Docker未被正确安装，可以参考[Docker的安装指南](https://docs.docker.com/engine/install/ubuntu/)。
        - **GPU驱动已被正确安装。**  您可以用[这个命令](./installation-faqs-and-troubleshooting.md#how-to-check-whether-the-gpu-driver-is-installed)来检查。 如果您的GPU驱动未被正确安装，可以参考[如何安装GPU驱动](./installation-faqs-and-troubleshooting.md#how-to-install-gpu-driver)。 如果您对安装哪个版本的GPU驱动有疑问，可以阅读[这个文档](./installation-faqs-and-troubleshooting.md#which-version-of-nvidia-driver-should-i-install)。
        - **[nvidia-container-runtime](https://github.com/NVIDIA/nvidia-container-runtime)或其他device runtime已被正确安装，并且被设置为Docker的默认runtime。请在[docker-config-file](https://docs.docker.com/config/daemon/#configure-the-docker-daemon)里进行设置。**
            - 您可以用命令`sudo docker run nvidia/cuda:10.0-base nvidia-smi`来检查这一项。如果该命令成功打出当前可用的显卡个数，就说明设置是没问题的。
            - 如果它未被正确安装，请参考[如何安装nvidia container runtime](./installation-faqs-and-troubleshooting.md#how-to-install-nvidia-container-runtime)。
    - 其他要求
        - 它是OpenPAI的专用服务器。OpenPAI管理它的所有CPU、内存和GPU资源。如果有其他工作负载，则可能由于资源不足而导致未知问题。

目前，OpenPAI还不支持高可用（HA），它只能使用一个master机器。我们会在将来添加HA功能。另外，您不能只使用一台机器来部署OpenPAI。您必须有一个dev box机器，一个master机器和至少一个worker机器。如果您想要在一台机器部署，请在[Github](https://github.com/microsoft/pai)提交一个功能请求。

#### 使用纯CPU worker的提示

目前，在安装脚本中，我们还不支持纯CPU的worker机器。如果您同时拥有GPU worker和CPU worker，请先使用GPU worker安装PAI。成功安装之后，您可以将CPU worker附加进来，并设置一个仅含CPU的虚拟集群，相关步骤请参阅[如何添加和移除结点](./how-to-add-and-remove-nodes.md)。 如果您只有CPU worker，我们还没有正式的安装支持。请在[Github](https://github.com/microsoft/pai)提交功能请求issue。

#### 关于网络问题的提示

如果您遇到网络问题，如机器无法下载某些文件，或无法连接到某个docker registry，请将提示的错误日志和kubespray合并为关键字，并搜索解决方案。您也可以参考[安装常见问题解答和故障排查](./installation-faqs-and-troubleshooting.md#troubleshooting)和[这个issue](https://github.com/microsoft/pai/issues/4516)。

## <div id="installation-from-scratch">从头开始安装</div>

除上述要求外，本安装脚本还要求**所有worker机器必须是同质的GPU服务器，即它们具有相同的硬件，例如CPU类型和编号、GPU类型和编号、内存大小等。**如果您有不同类型的worker，请在安装过程中首先只包含一种类型的worker，然后再根据[如何添加和移除结点](./how-to-add-and-remove-nodes.md)添加不同类型的worker。现在，请确认您的dev box机器, master机器和worker机器.

### <div id="create-configurations">创建设置文件</div>

在您决定所有机器后，请登录**dev box**机器，创建`master.csv`文件，`worker.csv`文件以及 `config`文件。这些文件分别表示master机器列表、worker机器列表和自定义配置。下面是这3个文件的格式和示例。

#### 关于中国用户的提示

如果您是中国用户，在创建这些文件前，请先阅读[这个文档](./configuration-for-china.md)。

###### `master.csv`格式

请**不要**在此文件中插入空行或使用空格。请**不要**在hostname中使用大写字母。

```
hostname(之后会成为Kuberntes中的Node Name),host-ip
```
###### `master.csv`示例
```
openpai-master-01,10.1.0.1
```
###### `worker.csv`格式

请**不要**在此文件中插入空行或使用空格。请**不要**在hostname中使用大写字母。

```
hostname(之后会成为Kuberntes中的Node Name),host-ip
```
###### `worker.csv` 示例
```
openpai-001,10.0.0.1
openpai-002,10.0.0.2
openpai-003,10.0.0.3
openpai-004,10.0.0.4
```

###### `config` 示例

```yaml
user: <your-ssh-username>
password: <your-ssh-password>
branch_name: pai-1.4.y
docker_image_tag: v1.4.0

# Optional

#############################################
# Ansible-playbooks' inventory hosts' vars. #
#############################################
# ssh_key_file_path: /path/to/you/key/file

#####################################
# OpenPAI's service image registry. #
#####################################
# docker_registry_domain: docker.io
# docker_registry_namespace: openpai
# docker_registry_username: exampleuser
# docker_registry_password: examplepasswd

################################################################
# OpenPAI's daemon qos config.                                 #
# By default, the QoS class for PAI daemon is BestEffort.      #
# If you want to promote QoS class to Burstable or Guaranteed, #
# you should set the value to true.                            #
################################################################
# qos-switch: "false"

###########################################################################################
#                         Pre-check setting                                               #
# By default, we assume your gpu environment is nvidia. So your runtime should be nvidia. #
# If you are using AMD or other environment, you should modify it.                        #
###########################################################################################
# worker_default_docker_runtime: nvidia
# docker_check: true

# resource_check: true

# gpu_type: nvidia

########################################################################################
# Advanced docker configuration. If you are not familiar with them, don't change them. #
########################################################################################
# docker_data_root: /mnt/docker
# docker_config_file_path: /etc/docker/daemon.json
# docker_iptables_enabled: false

## An obvious use case is allowing insecure-registry access to self hosted registries.
## Can be ipaddress and domain_name.
## example define 172.19.16.11 or mirror.registry.io
# openpai_docker_insecure_registries:
#   - mirror.registry.io
#   - 172.19.16.11

## Add other registry,example China registry mirror.
# openpai_docker_registry_mirrors:
#   - https://registry.docker-cn.com
#   - https://mirror.aliyuncs.com

#######################################################################
#                       kubespray setting                             #
#######################################################################

# If you couldn't access to gcr.io or docker.io, please configure it.
# gcr_image_repo: "gcr.io"
# kube_image_repo: "gcr.io/google-containers"
# quay_image_repo: "quay.io"
# docker_image_repo: "docker.io"
# kubeadm_download_url: "https://storage.googleapis.com/kubernetes-release/release/{{ kubeadm_version }}/bin/linux/{{ image_arch }}/kubeadm"
# hyperkube_download_url: "https://storage.googleapis.com/kubernetes-release/release/{{ kube_version }}/bin/linux/{{ image_arch }}/hyperkube"


# openpai_kube_network_plugin: calico
```
`branch-name` 和 `docker-image-tag`代表您想安装的OpenPAI的版本。`user`和`password`是master机器、worker机器共享的SSH用户名和密码。换句话说，您得确保所有master机器和worker机器有同样的SSH用户名和密码。 其他的配置为可选配置，只有当您清楚地知道它们的含义时，您可以去修改它，否则请不要修改。

**Azure用户请注意**： 如果您在Azure上部署OpenPAI，请去掉`openpai_kube_network_plugin: calico`的注释，并把它修改为`openpai_kube_network_plugin: weave`. 这是因为Azure暂时不支持calica。细节部分请参阅[这个文档](https://docs.projectcalico.org/reference/public-cloud/azure#why-doesnt-azure-support-calico-networking)。

**如果您在config中开启了qos-switch**： 此时，OpenPAI会在每个worker机器上要求额外的内存。请参考下面的表格，确保您的worker机器上有足够的内存：

| Service Name  | Memory Request | CPU Request |
| :-----------: | :------------: | :---------: |
| node-exporter |     128Mi      |      0      |
| job-exporter  |     512Mi      |      0      |
|  log-manager  |     256Mi      |      0      |

### 开始安装

在dev box机器上，使用下面的命令克隆OpenPAI的源代码。

```bash
git clone -b pai-1.4.y https://github.com/microsoft/pai.git # 如果您想要部署不同的版本，请切换到相应的branch。
cd pai/contrib/kubespray
```

文件夹`pai/contrib/kubespray`中包含kubespray（用于安装Kubernetes）的代码和安装OpenPAI服务的代码。 请先使用下面的命令来安装Kubernetes。请修改`/path/to` 为上述文件的路径。**不要**使用相对路径，相对路径将导致安装脚本出错。

```bash
/bin/bash quick-start-kubespray.sh -m /path/to/master.csv -w /path/to/worker.csv -c /path/to/config
```

Kubernetes安装成功后，请使用下面的代码来安装OpenPAI服务。请修改`/path/to` 为上述文件的路径。**不要**使用相对路径，相对路径将导致安装脚本出错。

```bash
/bin/bash quick-start-service.sh -m /path/to/master.csv -w /path/to/worker.csv -c /path/to/config
```

如果一切顺利，您将会看到下面的信息：

```
Kubernetes cluster config :     ~/pai-deploy/kube/config
OpenPAI cluster config    :     ~/pai-deploy/cluster-cfg
OpenPAI cluster ID        :     pai
Default username          :     admin
Default password          :     admin-password

You can go to http://<your-master-ip>, then use the default username and password to log in.
```

正如这个提示所说的，您可以用 `admin` 和 `admin-password` 来登录Webportal，并提交一个任务来验证安装。

#### 关于环境检查的提示

如果您的安装过程出错，请再次检查上述环境要求。我们也提供了一个脚本，帮助您进行检查。

```bash
/bin/bash requirement.sh -m /path/to/master.csv -w /path/to/worker.csv -c /path/to/config
```

### <div id="keep-a-folder">保留一个文件夹</div>

我们强烈建议您保留文件夹`~/pai-deploy`，以便将来进行升级、维护和卸载操作。此文件夹中最重要的内容包括：

  - Kubernetes集群配置（默认在`~/pai deploy/kube/config`）：Kubernetes配置文件。`kubectl`使用它连接到k8s api服务器。
  - OpenPAI服务配置（默认为`~/pai-deploy/cluster-cfg`）：一个包含您所有机器信息、OpenPAI服务配置的文件夹。

如果可能，可以备份`~/pai-deploy`以防意外删除。

除了文件夹之外，您还应该记住OpenPAI集群ID，它的默认值为`pai`。有些集群管理操作需要确认此ID。

## <div id="clean-previous-deployment">清除已有安装</div>

### 将旧数据备份

如果在您在`v1.0.0`之前安装过OpenPAI，要安装OpenPAI>=`v1.0.0`的话，需要先清除之前的部署。在清除之后，您不能保存任何有用的数据：所有任务、用户信息、数据集都将不可避免地、不可逆转地丢失。因此，如果在以前的部署中有任何有用的数据，请确保已将它们备份到其他位置。

#### HDFS数据

在`v1.0.0`之前，PAI会为您部署HDFS服务器。在`v1.0.0`之后，HDFS服务器将不会被部署。并且，升级时会删除以前的HDFS数据。

以下命令可用于备份旧的HDFS数据：

```bash
# 检查数据目录
hdfs dfs -ls hdfs://<hdfs-namenode-ip>:<hdfs-namenode-port>/

hdfs dfs -copyToLocal hdfs://<hdfs-namenode-ip>:<hdfs-namenode-port>/ <local-folder>
```

如果您之前没有修改过默认配置，`<hdfs-namenode-ip>`和`<hdfs-namenode-port>`就是PAI的master ip和`9000`。当然，在备份时请确保您磁盘空间的大小是足够的。

#### 任务和用户的数据

任务和用户的数据也将丢失，包括任务记录、任务日志、用户名、用户密码等。我们没有自动工具可供您备份这些数据。如果您发现有价值的数据，请手动进行备份。

#### 其他Kubernetes中的资源

因为Kubernetes集群也会被清除，若您在Kubernetes上部署了一些有用的资源，也请为它们做一个备份。

### 清除旧的OpenPAI

请使用以下命令清除旧的OpenPAI：

```bash
git clone https://github.com/Microsoft/pai.git
cd pai
#  如果您的旧安装是不同的版本，请切换到相应的branch
git checkout pai-0.14.y

# 删除OpenPAI服务以及所有数据
./paictl.py service delete

# 清除K8S集群
./paictl.py cluster k8s-clean -f -p <path-to-your-old-config>
```

如果找不到旧配置（即上述的`<path-to-your-old-config>`），以下命令可以帮您取回：

```bash
./paictl.py config pull -o <path-to-your-old-config>
```

另外，您还需要删除旧OpenPAI安装的GPU驱动，方法为使用`root`用户在每个GPU节点上执行以下命令：

```bash
#!/bin/bash

lsmod | grep -qE "^nvidia" &&
{
    DEP_MODS=`lsmod | tr -s " " | grep -E "^nvidia" | cut -f 4 -d " "`
    for mod in ${DEP_MODS//,/ }
    do
        rmmod $mod ||
        {
            echo "The driver $mod is still in use, can't unload it."
            exit 1
        }
    done
    rmmod nvidia ||
    {
        echo "The driver nvidia is still in use, can't unload it."
        exit 1
    }
}

rm -rf /var/drivers
reboot
```

在以上步骤成功后，您就可以跟随[从头开始安装](#installation-from-scratch)中的步骤安装OpenPAI >= `v1.0.0`了。
