# 如何添加和移除结点

OpenPAI暂时不支持修改master结点。因此，这里只提供添加worker结点的方法。您可以添加CPU或GPU结点到您的集群中。

## 如何添加结点

### 准备工作

请先检查您要添加的worker结点是否满足下面的要求：

  - Ubuntu 16.04 (18.04应该可用，但没有经过完整测试)
  - 必须有**固定的IP地址**，且可以和其他所有机器通信。
  - 可以访问Internet。尤其是可以访问Docker Hub。部署过程会从Docker Hub拉取Docker镜像。
  - SSH服务已开启，和目前其他的master/worker机器有同样的SSH用户名和密码，且该SSH用户有sudo权限。
  - (如果您添加的是CPU worker，请忽略本条要求) **GPU驱动已被正确安装。**  您可以用[这个命令](./installation-faqs-and-troubleshooting.md#how-to-check-whether-the-gpu-driver-is-installed)来检查。 如果您的GPU驱动未被正确安装，可以参考[如何安装GPU驱动](./installation-faqs-and-troubleshooting.md#how-to-install-gpu-driver)。 如果您对安装哪个版本的GPU驱动有疑问，可以阅读[这个文档](./installation-faqs-and-troubleshooting.md#which-version-of-nvidia-driver-should-i-install)。
  - Docker已被正确安装。您可以用命令`docker --version`来检查。如果您的Docker未被正确安装，可以参考[Docker的安装指南](https://docs.docker.com/engine/install/ubuntu/)。
  - (如果您添加的是CPU worker，请忽略本条要求) **[nvidia-container-runtime](https://github.com/NVIDIA/nvidia-container-runtime)或其他device runtime已被正确安装，并且被设置为Docker的默认runtime。请在[docker-config-file](https://docs.docker.com/config/daemon/#configure-the-docker-daemon)里进行设置。**
    - 您可以用命令`sudo docker run nvidia/cuda:10.0-base nvidia-smi`来检查这一项。如果该命令成功打出当前可用的显卡个数，就说明设置是没问题的。
    - 如果它未被正确安装，请参考[如何安装nvidia container runtime](./installation-faqs-and-troubleshooting.md#how-to-install-nvidia-container-runtime)。
  - 它是OpenPAI的专用服务器。OpenPAI管理它的所有CPU、内存和GPU资源。如果有其他工作负载，则可能由于资源不足而导致未知问题。

登录您的dev机器，并找到[之前保留的文件夹`~/pai-deploy`](./installation-guide.md#keep-a-folder).

### 将结点添加到Kubernetes中

找到文件`~/pai-deploy/kubespray/inventory/pai/hosts.yml`，并遵循下面的方法来修改它。

假设您想添加2个worker结点，它们的hostname分别为`a`和`b`。您需要将它们先添加到`hosts.yml`中，例如：

```yaml
all:
  hosts:
    origin1:
      ip: x.x.x.37
      access_ip: x.x.x.37
      ansible_host: x.x.x.37
      ansible_ssh_user: "username"
      ansible_ssh_pass: "your-password-here"
      ansible_become_pass: "your-password-here"
      ansible_ssh_extra_args: '-o StrictHostKeyChecking=no'
    origin2:
      ...
    origin3:
      ...
    origin4:
      ...

############# Example start ################### 
    a:
      ip: x.x.x.x
      access_ip: x.x.x.x
      ansible_host: x.x.x.x
      ansible_ssh_user: "username"
      ansible_ssh_pass: "your-password-here"
      ansible_become_pass: "your-password-here"
      ansible_ssh_extra_args: '-o StrictHostKeyChecking=no'
    b:
      ip: x.x.x.x
      access_ip: x.x.x.x
      ansible_host: x.x.x.x
      ansible_ssh_user: "username"
      ansible_ssh_pass: "your-password-here"
      ansible_become_pass: "your-password-here"
      ansible_ssh_extra_args: '-o StrictHostKeyChecking=no'
#############  Example end  ###################

  children:
    kube-master:
      hosts:
        origin1:
    kube-node:
      hosts:
        origin1:
        origin2:
        origin3:
        origin4:

############# Example start ################### 
        a:
        b:
############## Example end #################### 

    gpu:
      hosts:
        origin4:

############# Example start ################### 
###  CPU结点不需要在此处添加
        a:
        b:
############## Example end #################### 

    etcd:
      hosts:
        origin1:
        origin2:
        origin3:
    k8s-cluster:
      children:
        kube-node:
        kube-master:
    calico-rr:
      hosts: {}
``` 

进入文件夹`~/pai-deploy/kubespray/`，运行：

```bash
ansible-playbook -i inventory/pai/hosts.yml upgrade-cluster.yml --become --become-user=root  --limit=a,b -e "@inventory/pai/openpai.yml"
```

### 更新OpenPAI的服务配置

找到您的[集群配置文件 `layout.yaml` 和 `services-configuration.yaml`](./basic-management-operations.md#pai-service-management-and-paictl)。

- 将新结点添加到`layout.yaml`中：

```yaml
...

machine-list:

    ...

    - hostname: a
      hostip: x.x.x.x
      machine-type: sku
      nodename: a
      k8s-role: worker
      pai-worker: "true"


    - hostname: b
      hostip: x.x.x.x
      machine-type: sku
      nodename: b
      k8s-role: worker
      pai-worker: "true"
```

- 您需要在 `services-configuration.yaml`中适当修改hived的配置。 请参考[如何设置虚拟集群](./how-to-set-up-virtual-clusters.md)和[hived scheduler的文档](https://github.com/microsoft/hivedscheduler/blob/master/doc/user-manual.md)。

- 结束之前的服务，更新配置，并重启服务：

```bash
./paictl.py service stop -n cluster-configuration hivedscheduler rest-server
./paictl.py config push -p <config-folder> -m service
./paictl.py service start -n cluster-configuration hivedscheduler rest-server
```

如果您有设置过PV/PVC存储，请确认新添加的worker结点的环境满足对应PV的要求，细节请参考[确认Worker结点上的环境](./how-to-set-up-storage.md#confirm-environment-on-worker-nodes)。

## 如何移除结点

移除结点和添加结点非常相似，您可以参考之前添加结点的操作。

首先，修改`hosts.yml`，到`~/pai-deploy/kubespray/`文件夹中，运行：

```bash
ansible-playbook -i inventory/mycluster/hosts.yml upgrade-cluster.yml --become --become-user=root  --limit=a,b -e "@inventory/mycluster/openpai.yml"
``` 

修改`layout.yaml` 和 `services-configuration.yaml`。

结束之前的服务，更新配置，并重启服务：

```bash
./paictl.py service stop -n cluster-configuration hivedscheduler rest-server
./paictl.py config push -p <config-folder> -m service
./paictl.py service start -n cluster-configuration hivedscheduler rest-server
```
