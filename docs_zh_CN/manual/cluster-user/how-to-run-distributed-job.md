﻿## 如何构建分布式任务

### task role和instance

当我们在PAI上执行分布式程序时，我们可以为任务添加不同的`task role`。 单机器任务只有一个`task role`，而分布式任务可能有多个task role。 例如，当TensorFlow用于运行分布式作业时，它可能有两个`task role`，包括`parameter server` 和 `worker`。 在分布式作业中，每个`task role`可能具有一个或多个`instances`。假如一个TensorFlow任务中的某个`task role`有8个`instances`，那么这意味着该`task role`有8个Docker容器。具体操作请访问[这里](./how-to-use-advanced-job-settings.md#multiple-task-roles)。

### 使用环境变量

在分布式任务中，一个task可能与其他任务通信（这里的task指的是`task role`的单个`instance`）。因此，一个任务需要知道其他任务的运行时信息，例如IP，端口等。系统将这些运行时信息作为环境变量公开给每个任务的Docker容器。用户可以在容器中编写代码以访问那些运行时环境变量，来让不同的task容器相互通信。具体的操作请访问[这里](./how-to-use-advanced-job-settings.md#environmental-variables-and-port-reservation)。

### 重试策略和完成策略

如果发生未知错误，PAI将根据用户设置重试该任务。您可以在提交任务时切换到高级模式来为任务设置重试策略和完成策略。具体的操作请访问[这里](./how-to-use-advanced-job-settings.md#job-exit-spec-retry-policy-and-completion-policy) 。

### 在OpenPAI中构建PyTorch分布式任务

Example Name | Multi-GPU | Multi-Node | Backend |Apex| Job protocol |
---|---|---|---|---|---| 
Single-Node DataParallel CIFAR-10 | ✓| x | -|-| [cifar10-single-node-gpus-cpu-DP.yaml](https://github.com/microsoft/pai/tree/master/examples/Distributed-example/cifar10-single-node-gpus-cpu-DP.yaml)|
cifar10-single-mul-DDP-gloo.yaml | ✓|  ✓ | gloo|-| [cifar10-single-mul-DDP-gloo.yaml](https://github.com/microsoft/pai/tree/master/examples/Distributed-example/cifar10-single-mul-DDP-gloo.yaml)|
cifar10-single-mul-DDP-nccl | ✓| ✓ |nccl|-| [cifar10-single-mul-DDP-nccl.yaml](https://github.com/microsoft/pai/tree/master/examples/Distributed-example/cifar10-single-mul-DDP-nccl.yaml)|
cifar10-single-mul-DDP-gloo-Apex-mixed | ✓|  ✓ | gloo|✓ | [cifar10-single-mul-DDP-gloo-Apex-mixed.yaml](https://github.com/microsoft/pai/tree/master/examples/Distributed-example/cifar10-single-mul-DDP-gloo-Apex-mixed.yaml)|
cifar10-single-mul-DDP-nccl-Apex-mixed | ✓|  ✓ | nccl|  ✓ | [cifar10-single-mul-DDP-gloo-Apex-mixed.yaml](https://github.com/microsoft/pai/tree/master/examples/Distributed-example/cifar10-single-mul-DDP-gloo-Apex-mixed.yaml)|
imagenet-single-mul-DDP-gloo | ✓|  ✓| gloo|-| [imagenet-single-mul-DDP-gloo.yaml](https://github.com/microsoft/pai/tree/master/examples/Distributed-example/Lite-imagenet-single-mul-DDP-gloo.yaml)|

## DataParallel

单机器程序很简单，主要是应用PyTorch提供的DataParallel（简称DP）来实现多GPU训练。在PAI中执行的程序与我们在机器中直接执行的程序完全相同。我们可以在PAI中申请一个`worker` task role，并为它申请一个`instance`。在`instance`中，我们可以申请所需的GPU。我们提供了DP的[样例](../../../examples/Distributed-example/cifar10-single-node-gpus-cpu-DP.py) 。

## DistributedDataParallel

DistributedDataParallel（简称DDP）主要用于多机器的训练。DDP要求用户在PyTorch任务中设置主节点ip和端口以进行同步。对于端口，您可以简单地将一个特定端口（例如`5000`）设置为主端口。但是，此端口可能与其他端口冲突。为防止端口冲突，您可以在PAI中预留端口。具体信息请看[这里](./how-to-use-advanced-job-settings.md#environmental-variables-and-port-reservation)。预留的端口在环境变量中可用，例如`PAI_PORT_LIST_$taskRole_$taskIndex_$portLabel`，其中`$taskIndex`表示该`worker`的实例索引。例如，如果您的任务角色名称是`work`并且端口标签是`SyncPort`，则可以在PyTorch DDP程序中添加以下代码：

```
os.environ['MASTER_ADDR'] = os.environ['PAI_HOST_IP_worker_0']
os.environ['MASTER_PORT'] = os.environ['PAI_worker_0_SynPort_PORT']
```
如果您使用`gloo`作为DDP通信后端，请设置正确的网络接口，例如 `export GLOO_SOCKET_IFNAME=eth0`。


我们提供 [gloo](https://github.com/microsoft/pai/tree/master/examples/Distributed-example/cifar10-single-mul-DDP-gloo.yaml) 以及 [nccl](https://github.com/microsoft/pai/tree/master/examples/Distributed-example/cifar10-single-mul-DDP-nccl.yaml) 为后端的样例程序。

