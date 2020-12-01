# 常见问题解答

## 为何我的任务会自动重试？

一般来说，OpenPAI中存在三种错误类型：瞬时错误，永久错误和未知错误。在任务中，瞬时错误将一直重试，而永久错误永远不会重试。如果发生未知错误，PAI将会根据任务的[重试策略](./how-to-use-advanced-job-settings.md#job-exit-spec-retry-policy-and-completion-policy)重试该任务，此策略由用户设置。

如果您未设置任何[重试策略](./how-to-use-advanced-job-settings.md#job-exit-spec-retry-policy-and-completion-policy)却发现任务有意外的重试编号，可能是一些瞬时错误引起的，例如内存问题，磁盘压力或节点电源故障。另一种瞬时错误是抢占。优先级较高的任务可以抢占优先级较低的任务。在OpenPAI的[任务协议](https://github.com/microsoft/openpai-protocol/blob/master/schemas/v2/schema.yaml)中，您可以找到一个名为 `jobPriorityClass` 的字段，它定义了任务的优先级。