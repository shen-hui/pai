# 如何设置数据存储

本文档介绍了如何使用Kubernetes持久卷（PV）作为PAI上的存储。 要设置存储（nfs，samba，Azure blob等），您需要遵循下列步骤：

  1. 在Kubernetes上创建PV和PVC作为PAI存储。
  2. 确认工作程序节点具有正确的环境。例如，`NFS` PVC需apt包`nfs-common`才能在Ubuntu上运行。
  3. 将PVC授权给特定的用户组。

正确设置存储后，用户可以将这些PV/PVC装载进其任务中。 在PAI中，存储的名称就是PVC的名称。

## 在Kubernetes中创建PV和PVC 

创建PV/PVC的方法很多，如果您还不熟悉，可以参考[Kubernetes 文档](https://kubernetes.io/docs/concepts/storage/persistent-volumes/) 。 以下是一些常用的PV/PVC示例。

### NFS

```yaml
# NFS Persistent Volume
apiVersion: v1
kind: PersistentVolume
metadata:
  name: nfs-storage-pv
  labels:
    name: nfs-storage
spec:
  capacity:
    storage: 10Gi
  volumeMode: Filesystem
  accessModes:
    - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  mountOptions:
    - nfsvers=4.1
  nfs:
    path: /data
    server: 10.0.0.1
---
# NFS Persistent Volume Claim
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: nfs-storage
# labels:
#   share: "false"      # 在PAI中，如果设置为“false”，则表示个人存储（详情请参考下面的说明）
spec:
  accessModes:
    - ReadWriteMany
  volumeMode: Filesystem
  resources:
    requests:
      storage: 10Gi    # 不要超过上面PV的capacity
  selector:
    matchLabels:
      name: nfs-storage # 和上面PV的label相对应
```

将以上文件另存为`nfs-storage.yaml`，然后运行`kubectl apply -f nfs-storage.yaml`，就会为nfs服务器`nfs://10.0.0.1:/data`创建一个名为`nfs-storage-pv` 的PV和一个名为`nfs-storage`的PVC。PVC使用label `name: nfs-storage`绑定到特定的PV。在使用时，用户可以使用PVC名称`nfs-storage`作为存储名称，以在其任务中挂载该nfs存储。

可以将上述nfs配置为个人存储，以便每个用户只能访问自己单独的目录：例如Alice只能挂载`/data/Alice` ，而Bob只能挂载`/data/Bob`，您可以在PVC上添加一个`share: "false"`标签。 在这种情况下，当挂载到任务容器时，PAI将使用`${PAI_USER_NAME}` 作为子路径。

### Samba

请参考[这个文档](https://github.com/Azure/kubernetes-volume-drivers/blob/master/flexvolume/smb/README.md) 来安装`cifs/smb FlexVolume`的驱动以及为`Samba`创建`PV/PVC`。

### Azure Blob

请参考[这个文档](https://github.com/Azure/kubernetes-volume-drivers/blob/master/flexvolume/blobfuse/README.md) 来安装`blobfuse FlexVolume`的驱动以及为`Azure Blob`创建`PV/PVC`。

#### 提示

如果您无法将`blobfuse PVC`挂载到容器中，并且OpenPAI中的相应任务处于`WAITING`状态，请仔细检查以下要求：

**要求1.** 每个工作节点都应安装`blobfuse`。尝试以下命令来确保这一点：

```bash
# 如果您的系统不是Ubuntu 16.04，请把16.04改成对应的版本号
wget https://packages.microsoft.com/config/ubuntu/16.04/packages-microsoft-prod.deb
sudo dpkg -i packages-microsoft-prod.deb
sudo apt-get update
sudo apt-get install --assume-yes blobfuse fuse
```

**要求2.** `blobfuse` FlexVolume驱动程序已安装：

```sh
curl -s https://raw.githubusercontent.com/Azure/kubernetes-volume-drivers/master/flexvolume/blobfuse/deployment/blobfuse-flexvol-installer-1.9.yaml \
  | sed "s#path: /etc/kubernetes/volumeplugins/#path: /usr/libexec/kubernetes/kubelet-plugins/volume/exec/#g" \
  | kubectl apply -f -
```

> NOTE: 在同一节点上多次安装同一PV存在一个已知问题[#4637](https://github.com/microsoft/pai/issues/4637) ，可以选择以下两种处理方法:

>   * 用 [blobfuse flexvolume补丁安装程序](https://github.com/microsoft/pai/issues/4637#issuecomment-647434815) 来代替。
>   * 用 [earlier version 1.1.1](https://github.com/Azure/kubernetes-volume-drivers/issues/66#issuecomment-649188681) 来代替。

### Azure File

首先创建一个Kubernetes Secret：

```sh
kubectl create secret generic azure-secret --from-literal=azurestorageaccountname=$AKS_PERS_STORAGE_ACCOUNT_NAME --from-literal=azurestorageaccountkey=$STORAGE_KEY
```

然后创建PV/PVC：

```yaml
# Azure File Persistent Volume
apiVersion: v1
kind: PersistentVolume
metadata:
  name: azure-file-storage-pv
  labels:
    name: azure-file-storage
spec:
  capacity:
    storage: 5Gi
  accessModes:
    - ReadWriteMany
  storageClassName: azurefile
  azureFile:
    secretName: azure-secret
    shareName: aksshare
    readOnly: false
  mountOptions:
    - dir_mode=0777
    - file_mode=0777
    - uid=1000
    - gid=1000
    - mfsymlinks
    - nobrl
---
# Azure File Persistent Volume Claim
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: azure-file-storage
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: azurefile
  resources:
    requests:
      storage: 5Gi
  selector:
    matchLabels:
      name: azure-file-storage
```

可以在[这个文档](https://docs.microsoft.com/en-us/azure/aks/azure-files-volume) 中找到有关Azure File的更多详细信息。

### 只读存储

如果未经过特别指定，则用户可以读写OpenPAI中的存储。 如果您希望存储是只读的，请将相应的PV的属性`PersistentVolume.Spec.<PersistentVolumeSource>.ReadOnly`设置为`true`。

例如，您可以通过指定`spec.nfs.readOnly`字段来设置只读NFS PV：

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: nfs-storage-pv
  labels:
    name: nfs-storage
spec:
  ......
  nfs:
    readOnly: true
    .......
```

以下是只读AzureBlob PV的示例：

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: azure-file-storage-pv
  labels:
    name: azure-file-storage
spec:
  ......
  flexVolume:
    readOnly: true
    .......
```

请注意，`PersistentVolume.Spec.AccessModes` 和`PersistentVolumeClaim.Spec.AccessModes`不会影响存储在PAI中是否可写。 它们仅在PV和PVC之间的绑定时间内生效。

## <div id="confirm-environment-on-worker-nodes">确认Worker结点上的环境</div>

[Kubernetes文件中的声明](https://kubernetes.io/docs/concepts/storage/persistent-volumes/#persistent-volumes) 提到：PersistentVolume会需要在相应机器上安装一些辅助环境。 例如，如果要使用`NFS` PV，则所有工作节点都应安装`nfs-common`。 您可以在每个工作节点上使用命令`apt install nfs-common`来确认它。

由于不同的PV有不同的要求，您应根据PV的文档检查环境。

## <div id="assign-storage-to-pai-groups">将存储授权给用户组</div>

设置好PV/PVC并检查环境后，需要将存储授权给用户。在OpenPAI中，PVC的名称被直接用作存储名称，不同存储的访问由[用户组](./how-to-manage-users-and-groups.md)管理。要将存储分配给用户，请使用RESTful API。

在使用API之前，您应该获取API的访问Token。 转到您的个人资料页面并复制一个Token：

<img src="./imgs/get-token.png" />

在OpenPAI中，存储的访问权限是绑定到用户组的。 因此，您可以使用 [Group API](https://redocly.github.io/redoc/?url=https://raw.githubusercontent.com/microsoft/pai/master/src/rest-server/docs/swagger.yaml#tag/group) 将存储分配给用户组。

例如，如果要将`nfs-storage` PVC分配给`default`组，首先要调用GET `http(s)://<pai-master-ip>/rest-server/api/v2/groups/default`，它将返回：

```json
{
  "groupname": "default",
  "description": "group for default vc",
  "externalName": "",
  "extension": {
    "acls": {
      "storageConfigs": [],
      "admin": false,
      "virtualClusters": ["default"]
    }
  }
}
```

所有API请求都必须使用Header `Authorization：Bearer <token>`进行授权， 在返回中，有一项`storageConfigs`，它实际控制着该用户组可以使用哪些存储。要在其中添加一个`nfs-storage`，请PUT `http(s)://<pai-master-ip>/rest-server/api/v2/groups`。 请求的body为：

```json
{
  "data": {
    "groupname": "default",
    "extension": {
      "acls": {
        "storageConfigs": ["nfs-storage"],
        "admin": false,
        "virtualClusters": ["default"]
      }
    }
  },
  "patch": true
}
```

请勿在`extension`中省略任何字段，否则会意外更改`virtualClusters`等其他设置。

## 示例: 使用Storage Manager创建NFS + SAMBA服务器

为了简化存储配置，OpenPAI提供了一个`storage-manager`，它可以帮您启动一个NFS + SAMBA服务器。 在集群内部，用户可以在任务容器里挂载该NFS存储。 在集群之外，用户可以在类Unix的系统上挂载这个NFS存储，或在Windows的文件资源管理器中访问它。

请首先阅读有关[PAI服务管理和Paictl](./basic-management-operations.md#pai-service-management-and-paictl) 的文档，然后启动dev box容器。在dev box容器中，通过以下方式拉取目前集群中的配置：

```bash
./paictl config pull -o /cluster-configuration
```

要使用`storage-manager`，您首先应该将PAI系统中的一台机器确定为存储服务器。 它`必须`是PAI的Worker机器之一，而不是PAI的Master机器。 请打开`/cluster-configuration/layout.yaml`，选择一个Worker机器，然后在其中添加一个`pai-storage: "true"`字段。 以下是编辑后的`layout.yaml`的示例：

```yaml
......

- hostname: worker1
  nodename: worker1
  hostip: 10.0.0.1
  machine-type: GENERIC-WORKER
  pai-worker: "true"
  pai-storage: "true"  # this line is newly added

......
```

在本教程中，我们假设您选择IP为`10.0.0.1`的计算机作为存储服务器。 然后，在`/cluster-configuration/services-configuration.yaml`中，找到`storage-manager`部分：

```yaml
# storage-manager:
#   localpath: /share
#   security-type: AUTO
#   workgroup: WORKGROUP
#   smbuser: smbuser
#   smbpwd: smbpwd
```

取消注释：

```yaml
storage-manager:
  localpath: /share
#  security-type: AUTO
#  workgroup: WORKGROUP
  smbuser: smbuser
  smbpwd: smbpwd
```

`localpath`表示存储服务器上NFS的数据目录。 `smbuser`和`smbpwd`为您在Windows中访问该服务器时，需要输入的用户名和密码。

请遵循以下命令来启动`storage-manager`：

```bash
./paictl.py service stop -n cluster-configuration storage-manager
./paictl.py config push -p /cluster-configuration -m service
./paictl.py service start -n cluster-configuration storage-manager
```

如果`storage-manager`成功启动，您将在存储服务器上找到文件夹`/share/data`和`/share/users`。 在Ubuntu计算机上，可以使用以下命令测试NFS是否正确设置：

```bash 
# 请把 10.0.0.1 换成您的存储服务器的IP
sudo apt update 
sudo apt install nfs-common
mkmdir -p /mnt/data
sudo mount -t nfs --options nfsvers=4.1 10.0.0.1:/data/ /mnt/data
```

为了使NFS存储在PAI中可用，我们应该为其创建PV和PVC。 因此，首先在dev box容器中创建以下`nfs-storage.yaml`文件：

```yaml
# replace 10.0.0.1 with your storage server IP
# NFS Persistent Volume
apiVersion: v1
kind: PersistentVolume
metadata:
  name: nfs-storage-pv
  labels:
    name: nfs-storage
spec:
  capacity:
    storage: 10Gi
  volumeMode: Filesystem
  accessModes:
    - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  mountOptions:
    - nfsvers=4.1
  nfs:
    path: /data
    server: 10.0.0.1
---
# NFS Persistent Volume Claim
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: nfs-storage
# labels:
#   share: "false"
spec:
  accessModes:
    - ReadWriteMany
  volumeMode: Filesystem
  resources:
    requests:
      storage: 10Gi
  selector:
    matchLabels:
      name: nfs-storage
```

使用`kubectl create -f nfs-storage.yaml`创建PV和PVC。

由于Kuberentes PV要求使用它的节点具有相应的环境，所以我们应该使用`apt install nfs-common`在每个Worker机器上上安装`nfs-common`软件包。

最后，通过rest-server API [将存储授权给用户组](#assign-storage-to-pai-groups)。这样您可以将其挂载到任务容器中了。

如何上传数据到存储服务器？ 在Windows里，打开“文件资源管理器”，键入`\\10.0.0.1`（请将 `10.0.0.1`更改为您的存储服务器的IP），然后按Enter。 文件资源管理器将要求授权，这时请使用`smbuser`和`smbpwd`作为用户名和密码登录。 在类Unix系统中，可以将NFS文件夹直接挂载到文件系统上。 例如，在Ubuntu上，使用以下命令进行挂载：

```bash 
# 请把 10.0.0.1 换成您的存储服务器的IP
sudo apt update 
sudo apt install nfs-common
mkmdir -p /mnt/data
sudo mount -t nfs --options nfsvers=4.1 10.0.0.1:/data/ /mnt/data
```

上述步骤仅设置了基本的SAMBA服务器。 因此，在Windows中，每个用户会使用相同的用户名和密码来访问NFS。 如果您的群集处于[AAD模式](./how-to-manage-users-and-groups.md#users-and-groups-in-aad-mode)，并且您想要将SAMBA服务器与AAD系统集成，请参阅以下的`storage-manager`的配置：

```yaml
storage-manager:
  workgroup: # workgroup
  security-type: ADS
  default_realm: # default realm
  krb5_realms: # realms
    XXX1: # relam name
      kdc: # kdc
      default_domain: # default domain
    XXX2: # relam name
      kdc: # kdc
      default_domain: # default domain
  domain_realm: # domain realm
    kdc: # kdc
    default_domain: # default domain
  domainuser: # domain user
  domainpwd: # password of domain user
  idmap: # idmap
  - "idmap config XXX1"
  - "idmap config XXX2"
  - "idmap config XXX3"
  - "idmap config XXX4"
```
